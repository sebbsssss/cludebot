import { postReply, postTweet, postThread } from '../core/x-client';
import { markProcessed } from '../core/database';
import { TWEET_MAX_LENGTH } from '../utils/constants';
import { createChildLogger } from '../core/logger';

const log = createChildLogger('social');

/**
 * Social service — wraps X client with consistent truncation, logging, and processed-marking.
 *
 * Centralizes the repeated pattern of: truncate → post → mark processed → log.
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

export async function tweet(text: string): Promise<string> {
  const truncated = text.slice(0, TWEET_MAX_LENGTH);
  return postTweet(truncated);
}

export async function tweetThread(texts: string[]): Promise<string[]> {
  const truncated = texts.map(t => t.slice(0, TWEET_MAX_LENGTH));
  return postThread(truncated);
}
