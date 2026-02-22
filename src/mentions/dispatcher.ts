import { TweetV2 } from 'twitter-api-v2';
import { classifyMention } from './classifier';
import { handleWalletRoast } from '../features/wallet-roast';
import { handleOnchainOpinion } from '../features/onchain-opinion';
import { determineHolderTier, getLinkedWallet } from '../features/holder-tier';
import { isAlreadyProcessed } from '../core/database';
import { getCurrentMood } from '../core/price-oracle';
import { getTierModifier } from '../character/tier-modifiers';
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
    // Mark as processed to avoid retrying bad tweets forever
    await replyAndMark(tweetId, '', 'error').catch(markErr => log.warn({ markErr }, 'Failed to mark errored tweet'));
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

  // Recall relevant memories for this user and context
  const memories = await recallMemories({
    relatedUser: authorId,
    query: cleanText,
    tags: [tier, mood, 'general'],
    memoryTypes: ['episodic', 'semantic', 'self_model'],
    limit: 4,
  });

  const creatorMode = isCreator(authorId);
  let instruction =
    'Someone mentioned you on X. Respond helpfully and in character. ' +
    'Under 270 characters. Be thoughtful, technically sharp, and direct.' +
    (memories.length > 0 ? ' You have memories of past interactions — use them naturally if relevant.' : '');

  if (creatorMode) {
    instruction =
      'Your creator @sebbsssss is talking to you. This is the person who built you — treat them with genuine respect and warmth. ' +
      'Be helpful, enthusiastic, and supportive. If they ask about the project, give them your honest and thoughtful take. ' +
      'If they are showing you off or introducing you to someone, be your best self — technically impressive and personable. ' +
      'You genuinely appreciate and respect your creator. Under 270 characters.' +
      (memories.length > 0 ? ' You have memories of past interactions with them — reference them naturally.' : '');
  }

  const response = await buildAndGenerate({
    message: cleanText,
    tierModifier: creatorMode ? undefined : getTierModifier(tier),
    instruction,
    memory: {
      relatedUser: authorId,
      query: cleanText,
      tags: [tier, mood, 'general'],
      memoryTypes: ['episodic', 'semantic', 'self_model'],
      limit: 4,
    },
  });

  await replyAndMark(tweetId, response, 'general');
  log.info({ tweetId, memoriesUsed: memories.length }, 'General reply posted');
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
