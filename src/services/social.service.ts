import { postReply, postTweet, postThread } from '../core/x-client';
import { markProcessed } from '../core/database';
import { createChildLogger } from '../core/logger';

const log = createChildLogger('social');

/**
 * Social service — wraps X client with consistent logging and processed-marking.
 *
 * Centralizes the repeated pattern of: post → mark processed → log.
 * Note: Truncation now happens in x-client.ts with smart word-boundary truncation.
 */

export async function replyAndMark(
  tweetId: string,
  text: string,
  feature: string
): Promise<string> {
  // x-client handles smart truncation
  const replyId = await postReply(tweetId, text);
  await markProcessed(tweetId, feature, replyId);
  log.info({ tweetId, replyId, feature }, 'Reply posted and marked');
  return replyId;
}

export async function tweet(text: string): Promise<string> {
  // x-client handles smart truncation
  return postTweet(text);
}

export async function tweetThread(texts: string[]): Promise<string[]> {
  // x-client handles smart truncation
  return postThread(texts);
}
