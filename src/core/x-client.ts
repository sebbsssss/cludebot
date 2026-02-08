import { TwitterApi, TweetV2, UserV2 } from 'twitter-api-v2';
import { config } from '../config';
import { createChildLogger } from './logger';

const log = createChildLogger('x-client');

const client = new TwitterApi({
  appKey: config.x.apiKey,
  appSecret: config.x.apiSecret,
  accessToken: config.x.accessToken,
  accessSecret: config.x.accessSecret,
});

const rwClient = client.readWrite;

export async function postReply(tweetId: string, text: string): Promise<string> {
  const truncated = text.slice(0, 280);
  log.info({ tweetId, length: truncated.length }, 'Posting reply');
  const result = await rwClient.v2.reply(truncated, tweetId);
  return result.data.id;
}

export async function postTweet(text: string): Promise<string> {
  const truncated = text.slice(0, 280);
  log.info({ length: truncated.length }, 'Posting tweet');
  const result = await rwClient.v2.tweet(truncated);
  return result.data.id;
}

export async function postThread(texts: string[]): Promise<string[]> {
  log.info({ count: texts.length }, 'Posting thread');
  const tweetIds: string[] = [];

  let previousId: string | undefined;
  for (const text of texts) {
    const truncated = text.slice(0, 280);
    if (!previousId) {
      const result = await rwClient.v2.tweet(truncated);
      previousId = result.data.id;
    } else {
      const result = await rwClient.v2.reply(truncated, previousId);
      previousId = result.data.id;
    }
    tweetIds.push(previousId);
  }

  return tweetIds;
}

export async function getMentions(sinceId?: string): Promise<TweetV2[]> {
  log.debug({ sinceId }, 'Fetching mentions');
  const params: Record<string, string> = {
    'tweet.fields': 'created_at,author_id,conversation_id,text',
    max_results: '20',
  };
  if (sinceId) params.since_id = sinceId;

  const result = await rwClient.v2.userMentionTimeline(config.x.botUserId, params);
  return result.data?.data || [];
}

export async function getUserById(userId: string): Promise<UserV2 | null> {
  try {
    const result = await rwClient.v2.user(userId, {
      'user.fields': 'description,username,name,public_metrics',
    });
    return result.data;
  } catch (err) {
    log.warn({ userId, err }, 'Failed to fetch user');
    return null;
  }
}
