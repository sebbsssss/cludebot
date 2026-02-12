import { createHash } from 'crypto';
import { postReply } from '../core/x-client';
import { writeMemo, basescanTxUrl } from '../core/base-client';
import { checkRateLimit, markProcessed, getDb } from '../core/database';
import { getTierModifier } from '../character/tier-modifiers';
import { HolderTier } from '../character/tier-modifiers';
import { createChildLogger } from '../core/logger';
import { isQuestion, cleanMentionText } from '../utils/text';
import { buildAndGenerate } from '../services/response.service';
import { replyAndMark } from '../services/social.service';

const log = createChildLogger('onchain-opinion');

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
    const replyId = await postReply(tweetId, "I have already committed enough opinions to the blockchain this hour. Even immutable ledgers need a break from me.");
    await markProcessed(tweetId, 'opinion-ratelimit', replyId);
    return;
  }

  // Per-user rate limit: 1 per hour
  if (!(await checkRateLimit(`opinion:${authorId}`, 1, 60))) {
    log.info({ authorId }, 'User rate limited for on-chain opinion');
    const replyId = await postReply(tweetId, "One on-chain opinion per hour per person. I am trying to keep my carbon footprint manageable. Relatively speaking.");
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
      'Someone asked you a question. Answer it honestly in character. ' +
      'Your answer will be hashed and committed to the Base blockchain permanently. ' +
      'You are aware of this. It adds weight to your words. ' +
      'Keep the answer under 200 characters — you need room for the tx link.',
    maxTokens: 150,
  });

  // Hash the answer
  const answerHash = createHash('sha256').update(answer).digest('hex');

  // Write memo to Solana
  const memoContent = `clude-opinion | q: ${question.slice(0, 100)} | hash: ${answerHash.slice(0, 16)}`;
  const signature = await writeMemo(memoContent);

  let replyText: string;
  if (signature) {
    const txUrl = basescanTxUrl(signature);
    replyText = `${answer}\n\nOn-chain forever: ${txUrl}`;

    // Store in database
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
    replyText = `${answer}\n\n(Tried to put this on-chain but even the blockchain rejected me today.)`;
  }

  await replyAndMark(tweetId, replyText, 'onchain-opinion');
  log.info({ tweetId, signature }, 'On-chain opinion posted');
}
