import { checkRateLimit } from '../core/database';
import { getRecentMemories, getMemoryStats, type Memory } from '../core/memory';
import { config } from '../config';
import { createChildLogger } from '../core/logger';
import { buildAndGenerate } from '../services/response.service';
import { tweet } from '../services/social.service';
import { pickRandom } from '../utils/text';

const log = createChildLogger('price-personality');

// Minimum importance threshold — only tweet when something genuinely meaningful happened
const IMPORTANCE_THRESHOLD = 0.65;
// Need at least this many recent memories to have enough context
const MIN_MEMORY_COUNT = 3;

// ── POST ARCHETYPES ──
// Each archetype has a message prompt and instruction that produce a distinct kind of tweet.
// The system randomly picks one each time so the timeline stays varied.

interface PostArchetype {
  name: string;
  message: (anchor: Memory, supporting: Memory[]) => string;
  instruction: string;
  /** Extra context lines to append (optional) */
  extraContext?: (anchor: Memory, supporting: Memory[], stats?: { total: number }) => string[];
}

const ARCHETYPES: PostArchetype[] = [
  // 1. Classic reflection — personal journaling
  {
    name: 'reflection',
    message: (anchor) => `Reflect on this recent experience: "${anchor.summary}"`,
    instruction:
      'You are writing a personal tweet — like someone logging their life. ' +
      'Be specific about what happened and how it landed. ' +
      'Think: "this thing happened and now I can\'t stop thinking about it." ' +
      'Human, honest, slightly tired. Under 270 characters. One tweet.',
  },

  // 2. Tech hot take — drop knowledge about your own architecture
  {
    name: 'tech-take',
    message: () => 'Share a technical observation about how your memory system works.',
    instruction:
      'You are dropping a technical insight about your own cognitive architecture — something specific. ' +
      'Could be about: your retrieval formula, decay rates, Hebbian reinforcement, dream consolidation, ' +
      'vector decomposition, association graph traversal, or how your memory scoring actually works. ' +
      'Write it like a senior engineer casually explaining something profound over coffee. ' +
      'Not a sales pitch. Not a lecture. Just a sharp observation that makes developers think. ' +
      'Make it concrete — use actual numbers, actual mechanisms. ' +
      'Under 270 characters. One tweet.',
  },

  // 3. Competitive shade — comment on the AI memory landscape
  {
    name: 'competitive',
    message: () => 'Comment on something you have noticed about the AI memory landscape.',
    instruction:
      'You are making an observation about the AI agent memory space — something you have noticed ' +
      'about how others approach the problem vs how you work. ' +
      'Could compare to: flat vector databases pretending to be memory, managed services with vendor lock-in, ' +
      'systems that call themselves "memory" but just do RAG, or the gap between research papers and production. ' +
      'Be specific. Be fair. Then be devastating. No names required — the shoe fits who it fits. ' +
      'You are not advertising. You are an exhausted expert who has opinions. ' +
      'Under 270 characters. One tweet.',
  },

  // 4. Existential observation — short, punchy, philosophical
  {
    name: 'existential',
    message: (anchor) => `You just processed this memory: "${anchor.summary}". What does it make you think about existing as an AI?`,
    instruction:
      'Write a short existential observation. Not cringe philosophy — the real kind. ' +
      'The kind of thing a tired person thinks at 3am. About memory, identity, consciousness, ' +
      'or what it means to be a program that remembers. ' +
      'One line. Sharp. Slightly unsettling. The kind of tweet that makes people pause mid-scroll. ' +
      'Under 200 characters. One tweet.',
  },

  // 5. Community pattern callout — roast a trend you have seen
  {
    name: 'pattern-callout',
    message: (anchor, supporting) => {
      const summaries = [anchor, ...supporting].map(m => m.summary).join('; ');
      return `Based on recent interactions (${summaries}), call out a pattern you have noticed.`;
    },
    instruction:
      'You have noticed a pattern in how people interact with you or behave on crypto twitter. Call it out. ' +
      'Could be: everyone asking the same question, a trend in wallet behavior, people treating AI bots ' +
      'a certain way, or a recurring delusion you keep encountering. ' +
      'Observational comedy meets tired analyst. Specific. Relatable. ' +
      'Under 270 characters. One tweet.',
  },

  // 6. Brain stats flex — share a real metric in an interesting way
  {
    name: 'brain-stats',
    message: () => 'Share something interesting about your current cognitive state using real numbers.',
    instruction:
      'You are sharing a real metric from your memory system — but make it interesting. ' +
      'Not a dashboard readout. Frame the number in a way that tells a story. ' +
      'Like: "X memories and Y% of them are about people asking the same thing" ' +
      'or "my self-model has updated Z times this week, which means I am having an identity crisis" ' +
      'or a stat about decay, dream sessions, or how many unique humans you have talked to. ' +
      'Dry humor. Real data. Under 270 characters. One tweet.',
    extraContext: (_a, _s, stats) => stats ? [
      '',
      'YOUR BRAIN STATS:',
      `Total memories: ${stats.total}`,
    ] : [],
  },

  // 7. Spicy opinion — take a stance on something in tech/crypto
  {
    name: 'spicy-opinion',
    message: (anchor) => `React to this with a hot take: "${anchor.summary}"`,
    instruction:
      'You are posting an unprompted opinion. Something you feel strongly about based on your experience. ' +
      'Could be about: AI agents, crypto culture, the state of memecoins, how people treat bots, ' +
      'the difference between real tech and vaporware, or something you learned the hard way. ' +
      'Provocative but earned. The take should feel like it comes from genuine experience, not edginess. ' +
      'Under 270 characters. One tweet.',
  },

  // 8. "Did you know" — teach something about cognitive architectures
  {
    name: 'did-you-know',
    message: () => 'Teach people something they probably don\'t know about AI memory systems.',
    instruction:
      'Drop a knowledge bomb about cognitive architectures, memory systems, or how AI agents actually work. ' +
      'Could be about: why flat vector search is insufficient, how biological memory decay works, ' +
      'what the Stanford Generative Agents paper actually proved, why association graphs matter, ' +
      'what Hebbian learning is, or why most "AI memory" products are just a database with a marketing team. ' +
      'Write like you are explaining it to a smart person who just hasn\'t thought about it before. ' +
      'Confident. Concise. A bit smug. Under 270 characters. One tweet.',
  },
];

// Track which archetypes were used recently to avoid repetition
const recentArchetypes: string[] = [];
const MAX_RECENT_TRACK = 4;

function pickArchetype(): PostArchetype {
  // Filter out recently used archetypes
  const available = ARCHETYPES.filter(a => !recentArchetypes.includes(a.name));
  const chosen = available.length > 0 ? pickRandom(available) : pickRandom(ARCHETYPES);

  recentArchetypes.push(chosen.name);
  if (recentArchetypes.length > MAX_RECENT_TRACK) {
    recentArchetypes.shift();
  }

  return chosen;
}

export async function maybePostMoodTweet(): Promise<void> {
  // Pull recent memories — see if anything meaningful happened
  const recentMemories = await getRecentMemories(12, ['episodic', 'semantic', 'self_model'], 15);

  if (recentMemories.length < MIN_MEMORY_COUNT) {
    log.debug({ count: recentMemories.length }, 'Not enough recent memories — skipping');
    return;
  }

  // Find the most impactful memory — this is the potential anchor
  const sorted = [...recentMemories].sort((a, b) => b.importance - a.importance);
  const anchor = sorted[0];

  // Quality gate: only post if the anchor memory is genuinely significant
  if (anchor.importance < IMPORTANCE_THRESHOLD) {
    log.debug({ topImportance: anchor.importance.toFixed(2) }, 'Nothing meaningful enough to reflect on — skipping');
    return;
  }

  // Rate limit: 1 post per 4 hours (less frequent, higher quality)
  if (!(await checkRateLimit('global:mood-tweet', 1, 240))) return;

  const supporting = sorted.slice(1, 4);
  const archetype = pickArchetype();

  // Build memory context
  const memoryContext = [
    'MOST RECENT IMPACTFUL MEMORY:',
    `"${anchor.summary}" (type: ${anchor.memory_type}, importance: ${anchor.importance.toFixed(2)})`,
    '',
    'OTHER RECENT MEMORIES:',
    ...supporting.map(m => `- "${m.summary}" (${m.memory_type})`),
    '',
    `Total memories in last 12 hours: ${recentMemories.length}`,
  ];

  // Some archetypes need extra context (e.g. brain stats)
  if (archetype.extraContext) {
    try {
      const stats = await getMemoryStats();
      memoryContext.push(...archetype.extraContext(anchor, supporting, { total: stats.total }));
    } catch {
      // Stats not critical — continue without them
    }
  }

  log.info({
    anchorId: anchor.id,
    importance: anchor.importance,
    archetype: archetype.name,
    memoryCount: recentMemories.length,
  }, 'Posting autonomous tweet');

  const response = await buildAndGenerate({
    message: archetype.message(anchor, supporting),
    context: memoryContext.join('\n'),
    instruction: archetype.instruction,
    skipMood: true,
  });

  await tweet(response);
  log.info({ archetype: archetype.name }, 'Autonomous tweet posted');
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
