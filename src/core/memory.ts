import { getDb } from './database';
import { createChildLogger } from './logger';
import {
  clamp,
  timeAgo,
  MEMORY_DECAY_RATE,
  MEMORY_MIN_DECAY,
  MEMORY_MAX_CONTENT_LENGTH,
  MEMORY_MAX_SUMMARY_LENGTH,
  RECENCY_DECAY_BASE,
  RETRIEVAL_WEIGHT_RECENCY,
  RETRIEVAL_WEIGHT_RELEVANCE,
  RETRIEVAL_WEIGHT_IMPORTANCE,
} from '../utils';
import { generateImportanceScore } from './claude-client';
import { eventBus } from '../events/event-bus';

const log = createChildLogger('memory');

// ============================================================
// THE CORTEX — Clude's Memory System
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
//   self_model  — Clude's evolving understanding of itself
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
  evidence_ids: number[];
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
  evidenceIds?: number[];
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

// ---- STORE ---- //

export async function storeMemory(opts: StoreMemoryOptions): Promise<number | null> {
  const db = getDb();

  try {
    const { data, error } = await db
      .from('memories')
      .insert({
        memory_type: opts.type,
        content: opts.content.slice(0, MEMORY_MAX_CONTENT_LENGTH),
        summary: opts.summary.slice(0, MEMORY_MAX_SUMMARY_LENGTH),
        tags: opts.tags || [],
        emotional_valence: clamp(opts.emotionalValence ?? 0, -1, 1),
        importance: clamp(opts.importance ?? 0.5, 0, 1),
        source: opts.source,
        source_id: opts.sourceId || null,
        related_user: opts.relatedUser || null,
        related_wallet: opts.relatedWallet || null,
        metadata: opts.metadata || {},
        evidence_ids: opts.evidenceIds || [],
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

    // Notify reflection trigger system (Park et al. 2023 — event-driven reflection)
    eventBus.emit('memory:stored', {
      importance: clamp(opts.importance ?? 0.5, 0, 1),
      memoryType: opts.type,
    });

    return data.id;
  } catch (err) {
    log.error({ err }, 'Memory store failed');
    return null;
  }
}

// ---- RECALL ---- //

// Retrieves memories ranked by additive composite score (Park et al. 2023):
//   score = (w_recency * recency + w_relevance * relevance + w_importance * importance) * decay_factor
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
      query = query.overlaps('tags', opts.tags);
    }

    const { data, error } = await query;

    if (error) {
      log.error({ error: error.message }, 'Memory recall query failed');
      return [];
    }

    if (!data || data.length === 0) return [];

    // Score and rank
    const scored = data.map((mem: Memory) => ({
      ...mem,
      _score: scoreMemory(mem, opts),
    }));

    scored.sort((a: { _score: number }, b: { _score: number }) => b._score - a._score);
    const results = scored.slice(0, limit);

    // Update access counts in parallel
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

/**
 * Additive scoring function (Park et al. 2023, Generative Agents).
 *
 * score = (w_recency * recency + w_relevance * relevance + w_importance * importance) * decay_factor
 *
 * Recency: exponential decay from last access time (0.995^hours). Access resets the clock.
 * Relevance: average of keyword overlap and tag overlap (both 0-1).
 * Importance: direct use of memory.importance (0-1).
 * Decay: multiplicative gate — decayed memories are suppressed regardless of other factors.
 */
export function scoreMemory(mem: Memory, opts: RecallOptions): number {
  const now = Date.now();

  // Recency: exponential decay from last access (paper: 0.995^hours)
  const hoursSinceAccess = (now - new Date(mem.last_accessed).getTime()) / (1000 * 60 * 60);
  const recency = Math.pow(RECENCY_DECAY_BASE, hoursSinceAccess);

  // Text similarity (keyword overlap)
  let textScore = 0.5;
  if (opts.query) {
    const queryWords = opts.query.toLowerCase().split(/\s+/);
    const summaryLower = mem.summary.toLowerCase();
    const matches = queryWords.filter(w => w.length > 2 && summaryLower.includes(w)).length;
    textScore = 0.3 + 0.7 * Math.min(matches / Math.max(queryWords.length, 1), 1);
  }

  // Tag overlap score
  let tagScore = 0.5;
  if (opts.tags && opts.tags.length > 0 && mem.tags) {
    const overlap = mem.tags.filter(t => opts.tags!.includes(t)).length;
    tagScore = 0.5 + 0.5 * (overlap / opts.tags.length);
  }

  // Relevance: average of text and tag similarity
  const relevance = (textScore + tagScore) / 2;

  // Additive formula with paper weights, gated by decay
  const rawScore =
    RETRIEVAL_WEIGHT_RECENCY * recency +
    RETRIEVAL_WEIGHT_RELEVANCE * relevance +
    RETRIEVAL_WEIGHT_IMPORTANCE * mem.importance;

  return rawScore * mem.decay_factor;
}

// ---- ACCESS TRACKING ---- //

async function updateMemoryAccess(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const db = getDb();

  // Batch update in parallel instead of sequential loop
  await Promise.all(ids.map(async (id) => {
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
  }));
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
      .gt('decay_factor', MEMORY_MIN_DECAY);

    if (error || !data) return 0;

    let decayed = 0;
    for (const mem of data) {
      const newDecay = Math.max(mem.decay_factor * MEMORY_DECAY_RATE, MEMORY_MIN_DECAY);
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
      .gt('decay_factor', MEMORY_MIN_DECAY);

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
      output: output.slice(0, MEMORY_MAX_CONTENT_LENGTH),
      new_memories_created: newMemoryIds,
    });

  if (error) {
    log.error({ error: error.message }, 'Failed to store dream log');
  }
}

// ---- HELPERS ---- //

export function formatMemoryContext(memories: Memory[]): string {
  if (memories.length === 0) return '';

  const lines: string[] = ['## Memory Recall'];

  const episodic = memories.filter(m => m.memory_type === 'episodic');
  const semantic = memories.filter(m => m.memory_type === 'semantic');
  const procedural = memories.filter(m => m.memory_type === 'procedural');
  const selfModel = memories.filter(m => m.memory_type === 'self_model');

  if (episodic.length > 0) {
    lines.push('### Past Interactions');
    for (const m of episodic) {
      lines.push(`- [${timeAgo(m.created_at)}] ${m.summary}`);
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

/**
 * Score importance using LLM (Park et al. 2023).
 * Falls back to rule-based calculateImportance() on failure.
 */
export async function scoreImportanceWithLLM(
  description: string,
  fallbackOpts?: Parameters<typeof calculateImportance>[0]
): Promise<number> {
  try {
    const response = await generateImportanceScore(description);
    const parsed = parseInt(response.trim(), 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 10) {
      return parsed / 10;
    }
    log.warn({ response }, 'LLM importance score unparseable, using fallback');
    return calculateImportance(fallbackOpts || {});
  } catch (err) {
    log.warn({ err }, 'LLM importance scoring failed, using fallback');
    return calculateImportance(fallbackOpts || {});
  }
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
