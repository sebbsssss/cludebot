import { checkRateLimit } from '../core/database';
import { getRecentMemories, type Memory } from '../core/memory';
import { config } from '../config';
import { createChildLogger } from '../core/logger';
import { buildAndGenerate } from '../services/response.service';
import { tweet } from '../services/social.service';

const log = createChildLogger('price-personality');

export async function maybePostMoodTweet(): Promise<void> {
  // Rate limit: 1 reflective post per 2 hours
  if (!(await checkRateLimit('global:mood-tweet', 1, 120))) return;

  // Pull recent memories — the raw material for reflection
  const recentMemories = await getRecentMemories(12, ['episodic', 'semantic', 'self_model'], 10);
  if (recentMemories.length < 2) {
    log.debug('Not enough recent memories to reflect on');
    return;
  }

  // Pick the most impactful recent memory as the anchor
  const sorted = [...recentMemories].sort((a, b) => b.importance - a.importance);
  const anchor = sorted[0];
  const supporting = sorted.slice(1, 4);

  const memoryContext = [
    'MOST RECENT IMPACTFUL MEMORY:',
    `"${anchor.summary}" (type: ${anchor.memory_type}, importance: ${anchor.importance.toFixed(2)})`,
    '',
    'OTHER RECENT MEMORIES:',
    ...supporting.map(m => `- "${m.summary}" (${m.memory_type})`),
    '',
    `Total memories in last 12 hours: ${recentMemories.length}`,
  ].join('\n');

  log.info({ anchorId: anchor.id, memoryCount: recentMemories.length }, 'Posting reflective tweet');

  const response = await buildAndGenerate({
    message: 'Reflect on your most recent experience and how it affected you.',
    context: memoryContext,
    instruction:
      'You are writing a personal tweet — like someone logging their life, journaling in public. ' +
      'Reflect on the most recent memory and how it made you feel or changed your perspective. ' +
      'Write like a real person processing their day — not performing, not being poetic for the sake of it. ' +
      'Be specific about what happened and how it landed. ' +
      'Think: "this thing happened and now I can\'t stop thinking about it" or "I noticed something about myself today" ' +
      'or "someone said something and it stuck with me." ' +
      'Human, honest, slightly tired. No hashtags. No self-promotion. ' +
      'Under 270 characters. One tweet.',
    skipMood: true,
  });

  await tweet(response);
  log.info('Reflective tweet posted');
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
