import { createHash } from 'crypto';
import { generateResponse } from '../core/claude-client';
import { postReply } from '../core/x-client';
import { writeMemo, solscanTxUrl } from '../core/solana-client';
import { checkRateLimit, markProcessed, getDb } from '../core/database';
import { getCurrentMood } from '../core/price-oracle';
import { getMoodModifier } from '../character/mood-modifiers';
import { getTierModifier } from '../character/tier-modifiers';
import { HolderTier } from '../character/tier-modifiers';
import { createChildLogger } from '../core/logger';

const log = createChildLogger('onchain-opinion');

export function isQuestion(text: string): boolean {
  const cleaned = text.replace(/@\w+/g, '').trim();
  return cleaned.includes('?') || /^(ask|what|why|how|when|where|will|should|can|is|do|does)\b/i.test(cleaned);
}

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

  const question = tweetText.replace(/@\w+/g, '').trim();
  log.info({ question, tweetId }, 'Processing on-chain opinion');

  const mood = getCurrentMood();

  // Generate the opinion
  const answer = await generateResponse({
    userMessage: question,
    moodModifier: getMoodModifier(mood),
    tierModifier: getTierModifier(tier),
    featureInstruction:
      'Someone asked you a question. Answer it honestly in character. ' +
      'Your answer will be hashed and committed to the Solana blockchain permanently. ' +
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
    const txUrl = solscanTxUrl(signature);
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

  const replyId = await postReply(tweetId, replyText);
  await markProcessed(tweetId, 'onchain-opinion', replyId);
  log.info({ tweetId, signature }, 'On-chain opinion posted');
}
