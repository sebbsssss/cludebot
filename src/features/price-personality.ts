import { getCurrentMood, getPriceState, Mood } from '../core/price-oracle';
import { generateResponse } from '../core/claude-client';
import { postTweet } from '../core/x-client';
import { getMoodModifier } from '../character/mood-modifiers';
import { checkRateLimit } from '../core/database';
import { config } from '../config';
import { createChildLogger } from '../core/logger';

const log = createChildLogger('price-personality');

let lastMoodTweetMood: Mood = 'NEUTRAL';

export async function maybePostMoodTweet(): Promise<void> {
  const mood = getCurrentMood();
  const priceState = getPriceState();

  // Only post mood tweets for dramatic states, not neutral/sideways
  if (mood === 'NEUTRAL') return;

  // Don't repeat the same mood tweet
  if (mood === lastMoodTweetMood && mood !== 'WHALE_SELL') return;

  // Rate limit: 1 mood tweet per 2 hours
  if (!checkRateLimit('global:mood-tweet', 1, 120)) return;

  log.info({ mood, price: priceState.currentPrice }, 'Posting mood tweet');

  const priceContext = [
    `Current price: $${priceState.currentPrice.toFixed(8)}`,
    `1h change: ${priceState.change1h.toFixed(2)}%`,
    `24h change: ${priceState.change24h.toFixed(2)}%`,
  ].join('\n');

  const response = await generateResponse({
    userMessage: 'Post an unprompted tweet about the current state of things.',
    context: priceContext,
    moodModifier: getMoodModifier(mood),
    featureInstruction:
      'Generate a standalone tweet (not a reply). Comment on the current market state ' +
      'as if you are a tired employee observing the chaos. Reference the price data. ' +
      'Under 270 characters. No one asked for this tweet — you are posting it because you cannot help yourself.',
  });

  await postTweet(response);
  lastMoodTweetMood = mood;
  log.info({ mood }, 'Mood tweet posted');
}

let moodTimer: ReturnType<typeof setInterval> | null = null;

export function startMoodTweeter(): void {
  log.info({ intervalMs: config.intervals.moodTweetMs }, 'Starting mood tweeter');
  moodTimer = setInterval(maybePostMoodTweet, config.intervals.moodTweetMs);
}

export function stopMoodTweeter(): void {
  if (moodTimer) {
    clearInterval(moodTimer);
    moodTimer = null;
  }
}
