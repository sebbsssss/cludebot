import { createHash } from 'crypto';
import { postReply } from '../core/x-client';
import { writeMemo, solscanTxUrl } from '../core/solana-client';
import { checkRateLimit, markProcessed, getDb } from '../core/database';
import { config } from '../config';
import { getTierModifier } from '../character/tier-modifiers';
import { HolderTier } from '../character/tier-modifiers';
import { createChildLogger } from '../core/logger';
import { isQuestion, cleanMentionText } from '../utils/text';
import { pickRandom } from '../utils/text';
import { buildAndGenerate } from '../services/response.service';
import { replyAndMark } from '../services/social.service';

const log = createChildLogger('onchain-opinion');

const GLOBAL_COOLDOWN_REPLIES = [
  'Rate limit reached. Try again shortly.',
  'Rate limit reached. Back soon.',
  'Rate limit reached. Check back soon.',
  'Rate limit reached. Soon.',
  'Rate limit reached. Give me a bit.',
];

const USER_COOLDOWN_REPLIES = [
  'Already committed one this hour.',
  'One per hour. Try again later.',
  'Try again in a bit.',
  'Try again soon.',
];

// Re-export isQuestion for backward compat (classifier.ts imports it)
export { isQuestion };

export async function handleOnchainOpinion(
  tweetId: string,
  tweetText: string,
  authorId: string,
  tier: HolderTier
): Promise<void> {
  // Rate limit: 3 opinions per hour (SOL costs money)
  if (!(await checkRateLimit('global:opinion', 3, 60))) {
    log.info('Rate limited for on-chain opinion');
    const replyId = await postReply(tweetId, pickRandom(GLOBAL_COOLDOWN_REPLIES));
    await markProcessed(tweetId, 'opinion-ratelimit', replyId);
    return;
  }

  // Per-user rate limit: 1 per hour
  if (!(await checkRateLimit(`opinion:${authorId}`, 1, 60))) {
    log.info({ authorId }, 'User rate limited for on-chain opinion');
    const replyId = await postReply(tweetId, pickRandom(USER_COOLDOWN_REPLIES));
    await markProcessed(tweetId, 'opinion-ratelimit-user', replyId);
    return;
  }

  const question = cleanMentionText(tweetText);
  log.info({ question, tweetId }, 'Processing on-chain opinion');

  // Generate the opinion
  const answer = await buildAndGenerate({
    message: question,
    tierModifier: getTierModifier(tier),
    instruction:
      'Someone asked you a question. Answer it thoughtfully and honestly. ' +
      'Your answer will be SHA-256 hashed and committed to Solana permanently via memo transaction. ' +
      'That permanence matters to you — give a clear, considered answer. ' +
      'Keep it under 270 characters.',
    maxTokens: 150,
  });

  // Hash the answer
  const answerHash = createHash('sha256').update(answer).digest('hex');

  // Write memo to Solana
  const memoContent = `clude-opinion | q: ${question.slice(0, 100)} | hash: ${answerHash.slice(0, 16)}`;
  const signature = await writeMemo(memoContent);

  let replyText: string;
  if (signature) {
    // Tx link in tweets is toggleable via SHOW_TX_LINKS_IN_TWEETS env var
    if (config.features.showTxLinksInTweets) {
      const txUrl = solscanTxUrl(signature);
      replyText = `${answer}\n\nOn-chain forever: ${txUrl}`;
    } else {
      replyText = answer;
    }

    // Store in database (always keep the signature for the web UI)
    const db = getDb();
    await db
      .from('opinion_commits')
      .insert({
        tweet_id: tweetId,
        question,
        answer,
        answer_hash: answerHash,
        solana_signature: signature,
      });
  } else {
    replyText = `${answer}\n\n(On-chain commit failed this time — Solana RPC hiccup. The answer still stands.)`;
  }

  await replyAndMark(tweetId, replyText, 'onchain-opinion');
  log.info({ tweetId, signature }, 'On-chain opinion posted');
}
