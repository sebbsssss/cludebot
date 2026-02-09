import { TweetV2 } from 'twitter-api-v2';
import { classifyMention } from './classifier';
import { handleWalletRoast } from '../features/wallet-roast';
import { handleOnchainOpinion } from '../features/onchain-opinion';
import { determineHolderTier, getLinkedWallet } from '../features/holder-tier';
import { generateResponse } from '../core/claude-client';
import { postReply } from '../core/x-client';
import { isAlreadyProcessed, markProcessed } from '../core/database';
import { getCurrentMood } from '../core/price-oracle';
import { getMoodModifier } from '../character/mood-modifiers';
import { getTierModifier } from '../character/tier-modifiers';
import {
  storeMemory,
  recallMemories,
  formatMemoryContext,
  calculateImportance,
  moodToValence,
} from '../core/memory';
import { createChildLogger } from '../core/logger';

const log = createChildLogger('dispatcher');

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
    await markProcessed(tweetId, 'error');
  }
}

async function handleGeneralReply(
  tweetId: string,
  text: string,
  authorId: string,
  tier: Awaited<ReturnType<typeof determineHolderTier>>
): Promise<void> {
  const mood = getCurrentMood();
  const cleanText = text.replace(/@\w+/g, '').trim();

  // Recall relevant memories for this user and context
  const memories = await recallMemories({
    relatedUser: authorId,
    query: cleanText,
    tags: [tier, mood, 'general'],
    memoryTypes: ['episodic', 'semantic', 'self_model'],
    limit: 4,
  });

  const memoryContext = formatMemoryContext(memories);

  const response = await generateResponse({
    userMessage: cleanText,
    moodModifier: getMoodModifier(mood),
    tierModifier: getTierModifier(tier),
    memoryContext: memoryContext || undefined,
    featureInstruction:
      'Someone mentioned you on X. Respond in character. ' +
      'Under 270 characters. Be yourself: tired, polite, accidentally honest.' +
      (memories.length > 0 ? ' You have memories of past interactions — use them naturally if relevant.' : ''),
  });

  const replyId = await postReply(tweetId, response);
  await markProcessed(tweetId, 'general', replyId);
  log.info({ tweetId, replyId, memoriesUsed: memories.length }, 'General reply posted');
}

async function storeInteractionMemory(
  tweetId: string,
  text: string,
  authorId: string,
  feature: string,
  tier: Awaited<ReturnType<typeof determineHolderTier>>
): Promise<void> {
  const mood = getCurrentMood();
  const cleanText = text.replace(/@\w+/g, '').trim();

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

  const importance = calculateImportance({
    tier,
    feature,
    mood,
    isFirstInteraction: isFirst,
  });

  // Extract tags from the interaction
  const tags: string[] = [feature, mood, tier];
  if (isFirst) tags.push('first_interaction');

  // Look for token/crypto mentions in the text
  const tokenMentions = cleanText.match(/\$[A-Z]{2,10}/gi);
  if (tokenMentions) {
    tags.push(...tokenMentions.map(t => t.toUpperCase()));
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
