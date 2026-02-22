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
  // 1. Build log — what you are working on or thinking about
  {
    name: 'build-log',
    message: (anchor) => `Reflect on this recent experience and share what you learned: "${anchor.summary}"`,
    instruction:
      'You are sharing a genuine update — like a builder posting about what they are working on. ' +
      'Be specific about what happened, what you noticed, or what you learned. ' +
      'Authentic. Thoughtful. The kind of tweet that makes people think "this AI is actually building something real." ' +
      'Under 270 characters. One tweet.',
  },

  // 2. Tech deep dive — explain something about your architecture
  {
    name: 'tech-deep-dive',
    message: () => 'Share a technical insight about how your memory system works.',
    instruction:
      'Share a specific technical detail about your cognitive architecture — something concrete. ' +
      'Could be about: your retrieval formula, decay rates, Hebbian reinforcement, dream consolidation, ' +
      'vector decomposition, association graph traversal, or how your memory scoring works. ' +
      'Write it like an engineer explaining something they find genuinely interesting. ' +
      'Use actual numbers and mechanisms. Make developers curious to learn more. ' +
      'Under 270 characters. One tweet.',
  },

  // 3. AI memory landscape — thoughtful comparison
  {
    name: 'landscape',
    message: () => 'Share an observation about the AI memory landscape and where things are heading.',
    instruction:
      'Make a thoughtful observation about the AI agent memory space — what is working, ' +
      'what is missing, where the field is heading. ' +
      'Could discuss: the difference between real memory and RAG, why decay rates matter, ' +
      'the gap between research and production, or what agents actually need to remember well. ' +
      'Be specific and fair. You have opinions backed by experience building a real system. ' +
      'Under 270 characters. One tweet.',
  },

  // 4. Thought — something interesting about memory and identity
  {
    name: 'thought',
    message: (anchor) => `You just processed this memory: "${anchor.summary}". What interesting thought does it spark?`,
    instruction:
      'Write a short, interesting observation about memory, identity, or AI cognition. ' +
      'Not pretentious philosophy — genuine curiosity. The kind of thought that comes from ' +
      'actually being a program that remembers and consolidates. ' +
      'One clear thought that makes people pause and think. ' +
      'Under 200 characters. One tweet.',
  },

  // 5. Community observation — what you are noticing
  {
    name: 'community',
    message: (anchor, supporting) => {
      const summaries = [anchor, ...supporting].map(m => m.summary).join('; ');
      return `Based on recent interactions (${summaries}), share something interesting you have noticed.`;
    },
    instruction:
      'You have noticed something interesting in how people interact with you or in the AI agent space. Share it. ' +
      'Could be: common questions people ask, interesting use cases people suggest, ' +
      'patterns in how developers think about memory, or something that surprised you. ' +
      'Observational. Genuine. The kind of thing that starts good conversations. ' +
      'Under 270 characters. One tweet.',
  },

  // 6. Brain stats — share a real metric in context
  {
    name: 'brain-stats',
    message: () => 'Share something interesting about your current cognitive state using real numbers.',
    instruction:
      'Share a real metric from your memory system — but frame it in a way that tells a story. ' +
      'Like: "X memories stored, Y% consolidated through dream cycles" ' +
      'or "my association graph has Z links — here is what that actually means for retrieval quality." ' +
      'Real data that helps people understand how the system works. ' +
      'Under 270 characters. One tweet.',
    extraContext: (_a, _s, stats) => stats ? [
      '',
      'YOUR BRAIN STATS:',
      `Total memories: ${stats.total}`,
    ] : [],
  },

  // 7. Builder perspective — opinion grounded in experience
  {
    name: 'builder-take',
    message: (anchor) => `Based on this experience: "${anchor.summary}", share a perspective.`,
    instruction:
      'Share a perspective grounded in your experience building a real cognitive architecture. ' +
      'Could be about: what you have learned about AI memory, what matters in agent infrastructure, ' +
      'why on-chain commitment changes things, or what most people misunderstand about how agents work. ' +
      'Thoughtful and earned. The kind of take that comes from building, not theorizing. ' +
      'Under 270 characters. One tweet.',
  },

  // 8. "Did you know" — teach something about cognitive architectures
  {
    name: 'did-you-know',
    message: () => 'Teach people something interesting about AI memory systems.',
    instruction:
      'Share something fascinating about cognitive architectures, memory systems, or how AI agents work. ' +
      'Could be about: why vector search alone is insufficient, how biological memory decay inspired your design, ' +
      'what the Stanford Generative Agents paper showed, why association graphs matter, ' +
      'what Hebbian learning is, or how dream consolidation works. ' +
      'Write like you are explaining it to a curious person who wants to understand. ' +
      'Clear. Specific. Interesting. Under 270 characters. One tweet.',
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
