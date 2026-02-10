import { getDb } from './database';
import { createChildLogger } from './logger';
import { clamp, timeAgo } from '../utils/format';
import {
  MEMORY_CONTENT_MAX,
  MEMORY_SUMMARY_MAX,
  MEMORY_DECAY_RATE,
  MEMORY_DECAY_FLOOR,
  MEMORY_RECENCY_HALF_LIFE_HOURS,
} from '../utils/constants';

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
  query?: string;
  tags?: string[];
  relatedUser?: string;
  memoryTypes?: MemoryType[];
  limit?: number;
  minImportance?: number;
  minDecay?: number;
}

// ---- SCORING (pure, testable) ---- //

export interface MemoryScore {
  memory: Memory;
  score: number;
}

/**
 * Compute a composite recall score for a memory.
 *
 * Based on Stanford Generative Agents scoring:
 *   score = textRelevance × tagRelevance × importance × recency × decay
 *
 * Extracted as a pure function for testability.
 */
export function scoreMemory(
  mem: Memory,
  opts: { query?: string; tags?: string[]; now?: number }
): number {
  const now = opts.now ?? Date.now();
  const ageHours = (now - new Date(mem.created_at).getTime()) / (1000 * 60 * 60);
  const recencyWeight = 1 / (1 + ageHours / MEMORY_RECENCY_HALF_LIFE_HOURS);

  // Tag overlap score (0.5 base + up to 0.5 bonus)
  let tagScore = 0.5;
  if (opts.tags && opts.tags.length > 0 && mem.tags) {
    const overlap = mem.tags.filter(t => opts.tags!.includes(t)).length;
    tagScore = 0.5 + 0.5 * (overlap / opts.tags.length);
  }

  // Text similarity via keyword overlap (0.3 base + up to 0.7 bonus)
  let textScore = 0.5;
  if (opts.query) {
    const queryWords = opts.query.toLowerCase().split(/\s+/);
    const summaryLower = mem.summary.toLowerCase();
    const matches = queryWords.filter(w => w.length > 2 && summaryLower.includes(w)).length;
    textScore = 0.3 + 0.7 * Math.min(matches / Math.max(queryWords.length, 1), 1);
  }

  return textScore * tagScore * mem.importance * recencyWeight * mem.decay_factor;
}

// ---- STORE ---- //

export async function storeMemory(opts: StoreMemoryOptions): Promise<number | null> {
  const db = getDb();

  try {
    const { data, error } = await db
      .from('memories')
      .insert({
        memory_type: opts.type,
        content: opts.content.slice(0, MEMORY_CONTENT_MAX),
        summary: opts.summary.slice(0, MEMORY_SUMMARY_MAX),
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

/**
 * Retrieve memories ranked by composite score.
 * Over-fetches from the database, then re-ranks in-memory using scoreMemory().
 */
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
      .limit(limit * 3); // Over-fetch for re-ranking

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
      query = query.overlaps('tags', opts.tags);
    }

    const { data, error } = await query;

    if (error) {
      log.error({ error: error.message }, 'Memory recall query failed');
      return [];
    }

    if (!data || data.length === 0) return [];

    // Score and rank using extracted scoring function
    const now = Date.now();
    const scored = data
      .map((mem: Memory) => ({
        memory: mem,
        score: scoreMemory(mem, { query: opts.query, tags: opts.tags, now }),
      }))
      .sort((a: MemoryScore, b: MemoryScore) => b.score - a.score)
      .slice(0, limit);

    const results = scored.map((s: MemoryScore) => s.memory);

    // Batch update access counts asynchronously
    batchUpdateAccess(results.map((m: Memory) => m.id)).catch(err =>
      log.error({ err }, 'Failed to update memory access counts')
    );

    log.debug({
      recalled: results.length,
      topScore: scored[0]?.score?.toFixed(3),
      query: opts.query?.slice(0, 40),
    }, 'Memories recalled');

    return results;
  } catch (err) {
    log.error({ err }, 'Memory recall failed');
    return [];
  }
}

// ---- ACCESS TRACKING (batched) ---- //

/**
 * Batch update access counts and reset decay for recalled memories.
 * Single query instead of N+2 round trips.
 */
async function batchUpdateAccess(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const db = getDb();

  // Use a single update per ID but with Promise.all for concurrency
  const now = new Date().toISOString();
  await Promise.all(
    ids.map(async id => {
      const { error } = await db.rpc('increment_memory_access', { memory_id: id, accessed_at: now });
      if (error) {
        // Fallback: individual update if RPC not available
        await db
          .from('memories')
          .update({ last_accessed: now, decay_factor: 1.0 })
          .eq('id', id);
      }
    })
  );
}

// ---- DECAY ---- //

export async function decayMemories(): Promise<number> {
  const db = getDb();

  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await db
      .from('memories')
      .select('id, decay_factor')
      .lt('last_accessed', cutoff)
      .gt('decay_factor', MEMORY_DECAY_FLOOR);

    if (error || !data) return 0;

    let decayed = 0;
    for (const mem of data) {
      const newDecay = Math.max(mem.decay_factor * MEMORY_DECAY_RATE, MEMORY_DECAY_FLOOR);
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

// ---- STATS ---- //

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
    const { data: memories } = await db
      .from('memories')
      .select('memory_type, importance, decay_factor, created_at, related_user, tags')
      .gt('decay_factor', MEMORY_DECAY_FLOOR);

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

      stats.topTags = Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([tag, count]) => ({ tag, count }));

      const sorted = memories.map(m => m.created_at).sort();
      stats.oldestMemory = sorted[0] || null;
      stats.newestMemory = sorted[sorted.length - 1] || null;
    }

    const { count } = await db
      .from('dream_logs')
      .select('id', { count: 'exact', head: true });
    stats.totalDreamSessions = count || 0;
  } catch (err) {
    log.error({ err }, 'Failed to get memory stats');
  }

  return stats;
}

// ---- RECENT MEMORIES ---- //

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

// ---- SELF-MODEL ---- //

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

// ---- DREAM LOG ---- //

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
      output: output.slice(0, MEMORY_CONTENT_MAX),
      new_memories_created: newMemoryIds,
    });

  if (error) {
    log.error({ error: error.message }, 'Failed to store dream log');
  }
}

// ---- CONTEXT FORMATTING ---- //

export function formatMemoryContext(memories: Memory[]): string {
  if (memories.length === 0) return '';

  const lines: string[] = ['## Memory Recall'];

  const episodic = memories.filter(m => m.memory_type === 'episodic');
  const semantic = memories.filter(m => m.memory_type === 'semantic');
  const procedural = memories.filter(m => m.memory_type === 'procedural');
  const selfModel = memories.filter(m => m.memory_type === 'self_model');

  if (episodic.length > 0) {
    lines.push('### Past Interactions');
    for (const m of episodic) lines.push(`- [${timeAgo(m.created_at)}] ${m.summary}`);
  }

  if (semantic.length > 0) {
    lines.push('### Things You Know');
    for (const m of semantic) lines.push(`- ${m.summary}`);
  }

  if (procedural.length > 0) {
    lines.push('### Behavioral Patterns');
    for (const m of procedural) lines.push(`- ${m.summary}`);
  }

  if (selfModel.length > 0) {
    lines.push('### Self-Observations');
    for (const m of selfModel) lines.push(`- ${m.summary}`);
  }

  lines.push('');
  lines.push('Use these memories naturally. You REMEMBER these things. Reference them if relevant but do not force it.');

  return lines.join('\n');
}

// ---- IMPORTANCE SCORING ---- //

export function calculateImportance(opts: {
  tier?: string;
  feature?: string;
  mood?: string;
  isFirstInteraction?: boolean;
}): number {
  let score = 0.4;

  if (opts.tier === 'WHALE') score += 0.3;
  else if (opts.tier === 'SMALL') score += 0.1;
  else if (opts.tier === 'SELLER') score += 0.2;

  if (opts.feature === 'wallet-roast') score += 0.1;
  else if (opts.feature === 'question') score += 0.15;
  else if (opts.feature === 'exit-interview') score += 0.25;

  if (opts.mood === 'PUMPING' || opts.mood === 'DUMPING') score += 0.1;
  if (opts.mood === 'NEW_ATH' || opts.mood === 'WHALE_SELL') score += 0.15;

  if (opts.isFirstInteraction) score += 0.1;

  return clamp(score, 0, 1);
}

export function moodToValence(mood: string): number {
  switch (mood) {
    case 'PUMPING': return 0.3;
    case 'NEW_ATH': return 0.5;
    case 'DUMPING': return -0.4;
    case 'WHALE_SELL': return -0.6;
    case 'SIDEWAYS': return -0.1;
    default: return 0;
  }
}
