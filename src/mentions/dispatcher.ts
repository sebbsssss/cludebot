import { TweetV2 } from 'twitter-api-v2';
import { classifyMention } from './classifier';
import { handleWalletRoast } from '../features/wallet-roast';
import { handleOnchainOpinion } from '../features/onchain-opinion';
import { determineHolderTier, getLinkedWallet } from '../features/holder-tier';
import { isAlreadyProcessed, markProcessed } from '../core/database';
import { getCurrentMood } from '../core/price-oracle';
import { getTierModifier } from '../character/tier-modifiers';
import { getTweetWithContext } from '../core/x-client';
import { config } from '../config';
import {
  storeMemory,
  recallMemories,
  formatMemoryContext,
  scoreImportanceWithLLM,
  moodToValence,
} from '../core/memory';
import { createChildLogger } from '../core/logger';
import { cleanMentionText, extractTokenMentions } from '../utils/text';
import { buildAndGenerate } from '../services/response.service';
import { replyAndMark } from '../services/social.service';
import { loadInstruction } from '../utils/env-persona';

const log = createChildLogger('dispatcher');

function isCreator(authorId: string): boolean {
  return !!(config.x.creatorUserId && authorId === config.x.creatorUserId);
}

export async function dispatchMention(tweet: TweetV2): Promise<void> {
  const tweetId = tweet.id;
  const text = tweet.text || '';
  const authorId = tweet.author_id || '';

  // Skip already processed
  if (await isAlreadyProcessed(tweetId)) return;

  log.info({ tweetId, text: text.slice(0, 100) }, 'Processing mention');

  try {
    // Determine holder tier for all interactions
    const tier = await determineHolderTier(authorId);
    const mentionType = classifyMention(text);

    switch (mentionType) {
      case 'wallet-roast':
        await handleWalletRoast(tweetId, text, authorId, tier);
        break;

      case 'question':
        await handleOnchainOpinion(tweetId, text, authorId, tier);
        break;

      case 'general':
        await handleGeneralReply(tweetId, text, authorId, tier);
        break;
    }

    // Store episodic memory of this interaction (async, non-blocking)
    storeInteractionMemory(tweetId, text, authorId, mentionType, tier).catch(err =>
      log.error({ err }, 'Failed to store interaction memory')
    );
  } catch (err) {
    log.error({ tweetId, err }, 'Failed to dispatch mention');
    // Mark as processed to avoid retrying bad tweets forever — but don't post an empty reply
    await markProcessed(tweetId, 'error').catch(markErr => log.warn({ markErr }, 'Failed to mark errored tweet'));
  }
}

async function handleGeneralReply(
  tweetId: string,
  text: string,
  authorId: string,
  tier: Awaited<ReturnType<typeof determineHolderTier>>
): Promise<void> {
  const mood = getCurrentMood();
  const cleanText = cleanMentionText(text);

  // Fetch thread context — walk up the reply chain to understand the conversation
  let threadContext = '';
  try {
    const { parents } = await getTweetWithContext(tweetId, 3);
    if (parents.length > 0) {
      threadContext = parents
        .map(p => `@${p.author_id}: ${cleanMentionText(p.text || '')}`)
        .join('\n');
    }
  } catch {
    // Thread context is best-effort — continue without it
  }

  // Recall relevant memories for this user and context
  const memories = await recallMemories({
    relatedUser: authorId,
    query: cleanText,
    tags: [tier, mood, 'general'],
    memoryTypes: ['episodic', 'semantic', 'self_model'],
    limit: 4,
  });

  const creatorMode = isCreator(authorId);
  let instruction = loadInstruction('general', 'Respond helpfully. Under 280 characters.') +
    (memories.length > 0 ? ' You have memories of past interactions — use them naturally if relevant.' : '') +
    (threadContext ? ' You can see the conversation thread — stay on topic.' : '');

  if (creatorMode) {
    instruction = loadInstruction('creator', 'Your creator is talking to you. Be warm and helpful. Under 280 characters.') +
      (memories.length > 0 ? ' You have memories of past interactions with them — reference them naturally.' : '') +
      (threadContext ? ' You can see the conversation thread.' : '');
  }

  // Build context with thread if available
  const contextParts: string[] = [];
  if (threadContext) {
    contextParts.push('CONVERSATION THREAD (oldest first):');
    contextParts.push(threadContext);
    contextParts.push('');
    contextParts.push('LATEST MESSAGE (reply to this):');
  }

  const response = await buildAndGenerate({
    message: cleanText,
    context: contextParts.length > 0 ? contextParts.join('\n') : undefined,
    tierModifier: creatorMode ? undefined : getTierModifier(tier),
    instruction,
    forTwitter: true,  // Enforce 270 char limit
    memory: {
      relatedUser: authorId,
      query: cleanText,
      tags: [tier, mood, 'general'],
      memoryTypes: ['episodic', 'semantic', 'self_model'],
      limit: 4,
    },
  });

  await replyAndMark(tweetId, response, 'general');
  log.info({ tweetId, memoriesUsed: memories.length, threadDepth: threadContext ? threadContext.split('\n').length : 0 }, 'General reply posted');
}

async function storeInteractionMemory(
  tweetId: string,
  text: string,
  authorId: string,
  feature: string,
  tier: Awaited<ReturnType<typeof determineHolderTier>>
): Promise<void> {
  const mood = getCurrentMood();
  const cleanText = cleanMentionText(text);

  // Get wallet address if linked
  const walletLink = await getLinkedWallet(authorId);
  const walletAddress = walletLink?.wallet_address;

  // Check if this is the first interaction with this user
  const existingMemories = await recallMemories({
    relatedUser: authorId,
    memoryTypes: ['episodic'],
    limit: 1,
  });
  const isFirst = existingMemories.length === 0;

  const description = `User (tier: ${tier}) asked via ${feature}: "${cleanText.slice(0, 200)}"` +
    (isFirst ? ' (first interaction with this user)' : '') +
    ` during ${mood} market mood`;
  const importance = await scoreImportanceWithLLM(description, {
    tier,
    feature,
    mood,
    isFirstInteraction: isFirst,
  });

  // Extract tags from the interaction
  const tags: string[] = [feature, mood, tier];
  if (isFirst) tags.push('first_interaction');

  // Look for token/crypto mentions in the text
  const tokenMentions = extractTokenMentions(cleanText);
  if (tokenMentions.length > 0) {
    tags.push(...tokenMentions);
  }

  await storeMemory({
    type: 'episodic',
    content: `User (tier: ${tier}) asked via ${feature}: "${cleanText.slice(0, 300)}"`,
    summary: `${tier} user: "${cleanText.slice(0, 150)}"`,
    tags,
    emotionalValence: moodToValence(mood),
    importance,
    source: feature,
    sourceId: tweetId,
    relatedUser: authorId,
    relatedWallet: walletAddress,
    metadata: {
      mood,
      isFirstInteraction: isFirst,
    },
  });
}
