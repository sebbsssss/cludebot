import { getDb } from './database';
import { createChildLogger } from './logger';

const log = createChildLogger('memory');

// ============================================================
// THE CORTEX — Cluude's Memory System
//
// Inspired by:
// - Stanford's Generative Agents (recency + importance + relevance scoring)
// - MemGPT/Letta (multi-tier self-managed memory)
// - CoALA cognitive architecture (episodic/semantic/procedural)
// - Memp (procedural memory that improves from trajectories)
// - Anthropic's introspective awareness research
//
// 4 memory types:
//   episodic    — individual interaction records (conversations, events)
//   semantic    — distilled knowledge and beliefs (learned patterns)
//   procedural  — behavioral patterns (what works, what doesn't)
//   self_model  — Cluude's evolving understanding of itself
// ============================================================

export type MemoryType = 'episodic' | 'semantic' | 'procedural' | 'self_model';

export interface Memory {
  id: number;
  memory_type: MemoryType;
  content: string;
  summary: string;
  tags: string[];
  emotional_valence: number;
  importance: number;
  access_count: number;
  source: string;
  source_id: string | null;
  related_user: string | null;
  related_wallet: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  last_accessed: string;
  decay_factor: number;
}

export interface StoreMemoryOptions {
  type: MemoryType;
  content: string;
  summary: string;
  tags?: string[];
  emotionalValence?: number;
  importance?: number;
  source: string;
  sourceId?: string;
  relatedUser?: string;
  relatedWallet?: string;
  metadata?: Record<string, unknown>;
}

export interface RecallOptions {
  query?: string;            // Text to search against summaries
  tags?: string[];           // Tags to match
  relatedUser?: string;      // Filter by user
  memoryTypes?: MemoryType[];// Filter by type
  limit?: number;            // Max results
  minImportance?: number;    // Minimum importance threshold
  minDecay?: number;         // Minimum decay factor
}

// ---- STORE ---- //

export async function storeMemory(opts: StoreMemoryOptions): Promise<number | null> {
  const db = getDb();

  try {
    const { data, error } = await db
      .from('memories')
      .insert({
        memory_type: opts.type,
        content: opts.content.slice(0, 5000), // Cap content size
        summary: opts.summary.slice(0, 500),
        tags: opts.tags || [],
        emotional_valence: clamp(opts.emotionalValence ?? 0, -1, 1),
        importance: clamp(opts.importance ?? 0.5, 0, 1),
        source: opts.source,
        source_id: opts.sourceId || null,
        related_user: opts.relatedUser || null,
        related_wallet: opts.relatedWallet || null,
        metadata: opts.metadata || {},
      })
      .select('id')
      .single();

    if (error) {
      log.error({ error: error.message }, 'Failed to store memory');
      return null;
    }

    log.debug({
      id: data.id,
      type: opts.type,
      summary: opts.summary.slice(0, 60),
      importance: opts.importance,
    }, 'Memory stored');

    return data.id;
  } catch (err) {
    log.error({ err }, 'Memory store failed');
    return null;
  }
}

// ---- RECALL ---- //

// Retrieves memories ranked by a composite score:
//   score = tag_relevance * importance * recency_weight * decay_factor
// Uses text similarity (pg_trgm) when a query is provided.
export async function recallMemories(opts: RecallOptions): Promise<Memory[]> {
  const db = getDb();
  const limit = opts.limit || 5;
  const minDecay = opts.minDecay ?? 0.1;

  try {
    let query = db
      .from('memories')
      .select('*')
      .gte('decay_factor', minDecay)
      .order('importance', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit * 3); // Over-fetch then re-rank

    if (opts.memoryTypes && opts.memoryTypes.length > 0) {
      query = query.in('memory_type', opts.memoryTypes);
    }
    if (opts.relatedUser) {
      query = query.eq('related_user', opts.relatedUser);
    }
    if (opts.minImportance) {
      query = query.gte('importance', opts.minImportance);
    }
    if (opts.tags && opts.tags.length > 0) {
      // Match any of the provided tags
      query = query.overlaps('tags', opts.tags);
    }

    const { data, error } = await query;

    if (error) {
      log.error({ error: error.message }, 'Memory recall query failed');
      return [];
    }

    if (!data || data.length === 0) return [];

    // Score and rank
    const now = Date.now();
    const scored = data.map((mem: Memory) => {
      const ageHours = (now - new Date(mem.created_at).getTime()) / (1000 * 60 * 60);
      const recencyWeight = 1 / (1 + ageHours / 24); // Half-life of ~24 hours

      // Tag overlap score
      let tagScore = 0.5; // Base score
      if (opts.tags && opts.tags.length > 0 && mem.tags) {
        const overlap = mem.tags.filter(t => opts.tags!.includes(t)).length;
        tagScore = 0.5 + 0.5 * (overlap / opts.tags.length);
      }

      // Text similarity (simple keyword overlap if query provided)
      let textScore = 0.5;
      if (opts.query) {
        const queryWords = opts.query.toLowerCase().split(/\s+/);
        const summaryLower = mem.summary.toLowerCase();
        const matches = queryWords.filter(w => w.length > 2 && summaryLower.includes(w)).length;
        textScore = 0.3 + 0.7 * Math.min(matches / Math.max(queryWords.length, 1), 1);
      }

      const score = textScore * tagScore * mem.importance * recencyWeight * mem.decay_factor;

      return { ...mem, _score: score };
    });

    // Sort by composite score, take top N
    scored.sort((a: { _score: number }, b: { _score: number }) => b._score - a._score);
    const results = scored.slice(0, limit);

    // Update access counts asynchronously
    const ids = results.map((m: Memory) => m.id);
    updateMemoryAccess(ids).catch(() => {});

    log.debug({
      recalled: results.length,
      topScore: results[0]?._score?.toFixed(3),
      query: opts.query?.slice(0, 40),
    }, 'Memories recalled');

    return results;
  } catch (err) {
    log.error({ err }, 'Memory recall failed');
    return [];
  }
}

// ---- ACCESS TRACKING ---- //

async function updateMemoryAccess(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const db = getDb();

  for (const id of ids) {
    // Fetch current access_count, increment, update
    const { data: current } = await db
      .from('memories')
      .select('access_count')
      .eq('id', id)
      .single();

    await db
      .from('memories')
      .update({
        access_count: (current?.access_count || 0) + 1,
        last_accessed: new Date().toISOString(),
        decay_factor: 1.0, // Reset decay on access — memory is reinforced
      })
      .eq('id', id);
  }
}

// ---- DECAY ---- //

// Run daily: memories that haven't been accessed lose relevance over time
export async function decayMemories(): Promise<number> {
  const db = getDb();
  const DECAY_RATE = 0.95; // 5% decay per cycle
  const MIN_DECAY = 0.05;

  try {
    // Decay all memories that haven't been accessed in the last 24 hours
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await db
      .from('memories')
      .select('id, decay_factor')
      .lt('last_accessed', cutoff)
      .gt('decay_factor', MIN_DECAY);

    if (error || !data) return 0;

    let decayed = 0;
    for (const mem of data) {
      const newDecay = Math.max(mem.decay_factor * DECAY_RATE, MIN_DECAY);
      await db
        .from('memories')
        .update({ decay_factor: newDecay })
        .eq('id', mem.id);
      decayed++;
    }

    if (decayed > 0) {
      log.info({ decayed }, 'Memory decay applied');
    }

    return decayed;
  } catch (err) {
    log.error({ err }, 'Memory decay failed');
    return 0;
  }
}

// ---- STATS (for self-awareness) ---- //

export interface MemoryStats {
  total: number;
  byType: Record<MemoryType, number>;
  avgImportance: number;
  avgDecay: number;
  oldestMemory: string | null;
  newestMemory: string | null;
  totalDreamSessions: number;
  uniqueUsers: number;
  topTags: { tag: string; count: number }[];
}

export async function getMemoryStats(): Promise<MemoryStats> {
  const db = getDb();
  const stats: MemoryStats = {
    total: 0,
    byType: { episodic: 0, semantic: 0, procedural: 0, self_model: 0 },
    avgImportance: 0,
    avgDecay: 0,
    oldestMemory: null,
    newestMemory: null,
    totalDreamSessions: 0,
    uniqueUsers: 0,
    topTags: [],
  };

  try {
    // Total count by type
    const { data: memories } = await db
      .from('memories')
      .select('memory_type, importance, decay_factor, created_at, related_user, tags')
      .gt('decay_factor', 0.05);

    if (memories && memories.length > 0) {
      stats.total = memories.length;

      let impSum = 0;
      let decaySum = 0;
      const tagCounts: Record<string, number> = {};
      const users = new Set<string>();

      for (const m of memories) {
        const type = m.memory_type as MemoryType;
        if (type in stats.byType) stats.byType[type]++;
        impSum += m.importance;
        decaySum += m.decay_factor;
        if (m.related_user) users.add(m.related_user);
        if (m.tags) {
          for (const tag of m.tags) {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
          }
        }
      }

      stats.avgImportance = impSum / memories.length;
      stats.avgDecay = decaySum / memories.length;
      stats.uniqueUsers = users.size;

      // Sort tags by count
      stats.topTags = Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([tag, count]) => ({ tag, count }));

      // Oldest and newest
      const sorted = memories
        .map(m => m.created_at)
        .sort();
      stats.oldestMemory = sorted[0] || null;
      stats.newestMemory = sorted[sorted.length - 1] || null;
    }

    // Dream session count
    const { count } = await db
      .from('dream_logs')
      .select('id', { count: 'exact', head: true });
    stats.totalDreamSessions = count || 0;

  } catch (err) {
    log.error({ err }, 'Failed to get memory stats');
  }

  return stats;
}

// ---- RECENT MEMORIES (for consolidation) ---- //

export async function getRecentMemories(
  hours: number,
  types?: MemoryType[],
  limit?: number
): Promise<Memory[]> {
  const db = getDb();
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  let query = db
    .from('memories')
    .select('*')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(limit || 50);

  if (types && types.length > 0) {
    query = query.in('memory_type', types);
  }

  const { data, error } = await query;
  if (error) {
    log.error({ error: error.message }, 'Failed to get recent memories');
    return [];
  }

  return data || [];
}

// ---- SELF-MODEL MEMORIES ---- //

export async function getSelfModel(): Promise<Memory[]> {
  const db = getDb();

  const { data, error } = await db
    .from('memories')
    .select('*')
    .eq('memory_type', 'self_model')
    .gt('decay_factor', 0.2)
    .order('importance', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    log.error({ error: error.message }, 'Failed to get self model');
    return [];
  }

  return data || [];
}

// ---- STORE DREAM LOG ---- //

export async function storeDreamLog(
  sessionType: 'consolidation' | 'reflection' | 'emergence',
  inputMemoryIds: number[],
  output: string,
  newMemoryIds: number[]
): Promise<void> {
  const db = getDb();

  const { error } = await db
    .from('dream_logs')
    .insert({
      session_type: sessionType,
      input_memory_ids: inputMemoryIds,
      output: output.slice(0, 5000),
      new_memories_created: newMemoryIds,
    });

  if (error) {
    log.error({ error: error.message }, 'Failed to store dream log');
  }
}

// ---- HELPERS ---- //

// Build memory context string for injection into Claude's system prompt
export function formatMemoryContext(memories: Memory[]): string {
  if (memories.length === 0) return '';

  const lines: string[] = ['## Memory Recall'];

  // Group by type
  const episodic = memories.filter(m => m.memory_type === 'episodic');
  const semantic = memories.filter(m => m.memory_type === 'semantic');
  const procedural = memories.filter(m => m.memory_type === 'procedural');
  const selfModel = memories.filter(m => m.memory_type === 'self_model');

  if (episodic.length > 0) {
    lines.push('### Past Interactions');
    for (const m of episodic) {
      const age = getTimeAgo(m.created_at);
      lines.push(`- [${age}] ${m.summary}`);
    }
  }

  if (semantic.length > 0) {
    lines.push('### Things You Know');
    for (const m of semantic) {
      lines.push(`- ${m.summary}`);
    }
  }

  if (procedural.length > 0) {
    lines.push('### Behavioral Patterns');
    for (const m of procedural) {
      lines.push(`- ${m.summary}`);
    }
  }

  if (selfModel.length > 0) {
    lines.push('### Self-Observations');
    for (const m of selfModel) {
      lines.push(`- ${m.summary}`);
    }
  }

  lines.push('');
  lines.push('Use these memories naturally. You REMEMBER these things. Reference them if relevant but do not force it.');

  return lines.join('\n');
}

// Derive importance score from interaction context
export function calculateImportance(opts: {
  tier?: string;
  feature?: string;
  mood?: string;
  isFirstInteraction?: boolean;
}): number {
  let score = 0.4; // Base

  // Holder tier
  if (opts.tier === 'WHALE') score += 0.3;
  else if (opts.tier === 'SMALL') score += 0.1;
  else if (opts.tier === 'SELLER') score += 0.2; // Interesting — they left

  // Feature type
  if (opts.feature === 'wallet-roast') score += 0.1;
  else if (opts.feature === 'question') score += 0.15; // Committed on-chain
  else if (opts.feature === 'exit-interview') score += 0.25;

  // Mood (extreme moods = more memorable events)
  if (opts.mood === 'PUMPING' || opts.mood === 'DUMPING') score += 0.1;
  if (opts.mood === 'NEW_ATH' || opts.mood === 'WHALE_SELL') score += 0.15;

  // First interaction with user
  if (opts.isFirstInteraction) score += 0.1;

  return clamp(score, 0, 1);
}

// Derive emotional valence from mood
export function moodToValence(mood: string): number {
  switch (mood) {
    case 'PUMPING': return 0.3;   // Cautiously positive
    case 'NEW_ATH': return 0.5;   // Suspicious optimism
    case 'DUMPING': return -0.4;  // Validated pessimism
    case 'WHALE_SELL': return -0.6; // Melancholic
    case 'SIDEWAYS': return -0.1; // Existential boredom
    default: return 0;
  }
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function getTimeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}
