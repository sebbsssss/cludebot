import { postReply, postTweet, postThread } from '../core/x-client';
import { markProcessed } from '../core/database';
import { TWEET_MAX_LENGTH } from '../utils/constants';
import { createChildLogger } from '../core/logger';

const log = createChildLogger('social-service');

// ============================================================
// Social Service
//
// Wraps X (Twitter) client with consistent truncation,
// logging, and process-marking. Features call this service
// instead of importing x-client + database separately.
//
// Single place to change if the social platform ever changes
// (e.g. adding Farcaster, Bluesky, etc.).
// ============================================================

/**
 * Post a reply to a tweet with automatic truncation and process marking.
 */
export async function replyAndMark(
  tweetId: string,
  text: string,
  feature: string
): Promise<string> {
  const truncated = text.slice(0, TWEET_MAX_LENGTH);
  const replyId = await postReply(tweetId, truncated);
  await markProcessed(tweetId, feature, replyId);
  log.info({ tweetId, replyId, feature }, 'Reply posted and marked');
  return replyId;
}

/**
 * Post a standalone tweet with automatic truncation.
 */
export async function tweet(text: string): Promise<string> {
  const truncated = text.slice(0, TWEET_MAX_LENGTH);
  const tweetId = await postTweet(truncated);
  log.info({ tweetId }, 'Tweet posted');
  return tweetId;
}

/**
 * Post a thread with automatic truncation per tweet.
 */
export async function tweetThread(texts: string[]): Promise<string[]> {
  const truncated = texts.map(t => t.slice(0, TWEET_MAX_LENGTH));
  const ids = await postThread(truncated);
  log.info({ count: ids.length }, 'Thread posted');
  return ids;
}
