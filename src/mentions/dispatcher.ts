import { TweetV2 } from 'twitter-api-v2';
import { classifyMention } from './classifier';
import { handleWalletRoast } from '../features/wallet-roast';
import { handleOnchainOpinion } from '../features/onchain-opinion';
import { determineHolderTier } from '../features/holder-tier';
import { generateResponse } from '../core/claude-client';
import { postReply } from '../core/x-client';
import { isAlreadyProcessed, markProcessed } from '../core/database';
import { getCurrentMood } from '../core/price-oracle';
import { getMoodModifier } from '../character/mood-modifiers';
import { getTierModifier } from '../character/tier-modifiers';
import { createChildLogger } from '../core/logger';

const log = createChildLogger('dispatcher');

export async function dispatchMention(tweet: TweetV2): Promise<void> {
  const tweetId = tweet.id;
  const text = tweet.text || '';
  const authorId = tweet.author_id || '';

  // Skip already processed
  if (isAlreadyProcessed(tweetId)) return;

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
  } catch (err) {
    log.error({ tweetId, err }, 'Failed to dispatch mention');
    // Mark as processed to avoid retrying bad tweets forever
    markProcessed(tweetId, 'error');
  }
}

async function handleGeneralReply(
  tweetId: string,
  text: string,
  authorId: string,
  tier: Awaited<ReturnType<typeof determineHolderTier>>
): Promise<void> {
  const mood = getCurrentMood();

  const response = await generateResponse({
    userMessage: text.replace(/@\w+/g, '').trim(),
    moodModifier: getMoodModifier(mood),
    tierModifier: getTierModifier(tier),
    featureInstruction:
      'Someone mentioned you on X. Respond in character. ' +
      'Under 270 characters. Be yourself: tired, polite, accidentally honest.',
  });

  const replyId = await postReply(tweetId, response);
  markProcessed(tweetId, 'general', replyId);
  log.info({ tweetId, replyId }, 'General reply posted');
}
