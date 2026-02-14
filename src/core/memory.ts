import { getDb } from './database';
import { createChildLogger } from './logger';
import {
  clamp,
  timeAgo,
  MEMORY_MIN_DECAY,
  MEMORY_MAX_CONTENT_LENGTH,
  MEMORY_MAX_SUMMARY_LENGTH,
  RECENCY_DECAY_BASE,
  RETRIEVAL_WEIGHT_RECENCY,
  RETRIEVAL_WEIGHT_RELEVANCE,
  RETRIEVAL_WEIGHT_IMPORTANCE,
  RETRIEVAL_WEIGHT_VECTOR,
  DECAY_RATES,
  EMBEDDING_FRAGMENT_MAX_LENGTH,
} from '../utils';
import { generateImportanceScore } from './claude-client';
import { writeMemo } from './solana-client';
import { generateEmbedding, generateEmbeddings, isEmbeddingEnabled } from './embeddings';
import { eventBus } from '../events/event-bus';
import { createHash } from 'crypto';

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
// Enhancements beyond Generative Agents:
// - Hybrid retrieval: vector similarity + keyword + tag scoring
// - Granular vector decomposition: per-fragment embeddings for precision
// - Type-specific decay: episodic fades fast, identity persists
// - Structured concept ontology: controlled vocabulary for cross-cutting knowledge
// - Progressive disclosure: lightweight summaries → full hydration on demand
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
  concepts: string[];
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
  solana_signature: string | null;
}

/** Lightweight memory summary for progressive disclosure (no content field). */
export interface MemorySummary {
  id: number;
  memory_type: MemoryType;
  summary: string;
  tags: string[];
  concepts: string[];
  importance: number;
  decay_factor: number;
  created_at: string;
  source: string;
}

export interface StoreMemoryOptions {
  type: MemoryType;
  content: string;
  summary: string;
  tags?: string[];
  concepts?: string[];
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
  /** Skip access tracking (prevents decay reset). Use for internal processing like dream cycles. */
  trackAccess?: boolean;
  /** Pre-computed vector similarity scores from hybrid search (internal use). */
  _vectorScores?: Map<number, number>;
}

// ---- CONCEPT ONTOLOGY ---- //

/**
 * Auto-classify memories into structured concepts using keyword heuristics.
 * Provides consistent cross-cutting knowledge labels without LLM cost.
 * Concepts are additive to freeform tags, not a replacement.
 */
export function inferConcepts(summary: string, source: string, tags: string[]): string[] {
  const concepts: string[] = [];
  const lower = summary.toLowerCase();
  const tagSet = new Set(tags.map(t => t.toLowerCase()));

  if (source === 'market' || tagSet.has('price') || /price|pump|dump|ath|market|volume/.test(lower))
    concepts.push('market_event');
  if (/whale|holder|seller|buyer|exit|accumula/.test(lower))
    concepts.push('holder_behavior');
  if (source === 'reflection' || source === 'emergence' || /myself|i am|i feel|identity|who i/.test(lower))
    concepts.push('self_insight');
  if (source === 'mention' || /tweet|reply|said|asked|mentioned|dm/.test(lower))
    concepts.push('social_interaction');
  if (/pattern|trend|recurring|always|usually|community/.test(lower))
    concepts.push('community_pattern');
  if (/token|sol|mint|swap|transfer|liquidity|staking/.test(lower))
    concepts.push('token_economics');
  if (/mood|sentiment|feel|vibe|energy|atmosphere/.test(lower))
    concepts.push('sentiment_shift');
  if (tagSet.has('first_interaction') || /returning|regular|again|came back/.test(lower))
    concepts.push('recurring_user');
  if (/whale|large|massive|huge|big (buy|sell)/.test(lower))
    concepts.push('whale_activity');
  if (/price|chart|candle|volume|mcap|cap/.test(lower))
    concepts.push('price_action');
  if (/engagement|likes|retweet|viral|reach|impressions/.test(lower))
    concepts.push('engagement_pattern');
  if (source === 'emergence' || /becoming|evolving|changed|grew|identity/.test(lower))
    concepts.push('identity_evolution');

  return [...new Set(concepts)];
}

// ---- STORE ---- //

export async function storeMemory(opts: StoreMemoryOptions): Promise<number | null> {
  const db = getDb();

  // Auto-classify concepts if not explicitly provided
  const concepts = opts.concepts || inferConcepts(opts.summary, opts.source, opts.tags || []);

  try {
    const { data, error } = await db
      .from('memories')
      .insert({
        memory_type: opts.type,
        content: opts.content.slice(0, MEMORY_MAX_CONTENT_LENGTH),
        summary: opts.summary.slice(0, MEMORY_MAX_SUMMARY_LENGTH),
        tags: opts.tags || [],
        concepts,
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
      concepts,
    }, 'Memory stored');

    // Notify reflection trigger system (Park et al. 2023 — event-driven reflection)
    eventBus.emit('memory:stored', {
      importance: clamp(opts.importance ?? 0.5, 0, 1),
      memoryType: opts.type,
    });

    // Commit memory to Solana (fire-and-forget)
    commitMemoryToChain(data.id, opts).catch(err => log.warn({ err }, 'On-chain memory commit failed'));

    // Generate embeddings and store fragments (fire-and-forget)
    embedMemory(data.id, opts).catch(err => log.warn({ err }, 'Embedding generation failed'));

    return data.id;
  } catch (err) {
    log.error({ err }, 'Memory store failed');
    return null;
  }
}

// ---- ON-CHAIN COMMIT ---- //

async function commitMemoryToChain(memoryId: number, opts: StoreMemoryOptions): Promise<void> {
  // Skip mainnet commits for demo memories (they use devnet instead)
  if (opts.source === 'demo' || opts.source === 'demo-maas') return;

  const contentHash = createHash('sha256').update(opts.content).digest('hex');
  const memo = `clude-memory | id: ${memoryId} | type: ${opts.type} | hash: ${contentHash.slice(0, 16)} | ${opts.summary.slice(0, 400)}`;

  const signature = await writeMemo(memo);
  if (!signature) return;

  const db = getDb();
  await db
    .from('memories')
    .update({ solana_signature: signature })
    .eq('id', memoryId);

  log.debug({ memoryId, signature: signature.slice(0, 16) }, 'Memory committed on-chain');
}

// ---- EMBEDDING & GRANULAR DECOMPOSITION ---- //

/**
 * Generate vector embedding for a memory and decompose into semantic fragments.
 * Each fragment gets its own embedding for precise sub-memory retrieval.
 *
 * Fragment types:
 *   summary     — the memory's summary (always stored)
 *   content_chunk — content split at natural boundaries
 *   tag_context — tags + concepts as a descriptive sentence
 */
async function embedMemory(memoryId: number, opts: StoreMemoryOptions): Promise<void> {
  if (!isEmbeddingEnabled()) return;

  const db = getDb();

  // Build fragment texts for granular decomposition
  const fragments: { type: string; text: string }[] = [];

  // Fragment 1: Summary (always)
  fragments.push({ type: 'summary', text: opts.summary });

  // Fragment 2+: Content chunks (split at sentence/paragraph boundaries)
  const content = opts.content.slice(0, MEMORY_MAX_CONTENT_LENGTH);
  if (content.length > EMBEDDING_FRAGMENT_MAX_LENGTH) {
    const sentences = content.match(/[^.!?\n]+[.!?\n]+/g) || [content];
    let chunk = '';
    for (const sentence of sentences) {
      if (chunk.length + sentence.length > EMBEDDING_FRAGMENT_MAX_LENGTH && chunk.length > 0) {
        fragments.push({ type: 'content_chunk', text: chunk.trim() });
        chunk = '';
      }
      chunk += sentence;
    }
    if (chunk.trim()) fragments.push({ type: 'content_chunk', text: chunk.trim() });
  } else {
    fragments.push({ type: 'content_chunk', text: content });
  }

  // Fragment 3: Tag/concept context as natural language
  const allLabels = [...(opts.tags || []), ...(opts.concepts || inferConcepts(opts.summary, opts.source, opts.tags || []))];
  if (allLabels.length > 0) {
    fragments.push({ type: 'tag_context', text: `Context: ${allLabels.join(', ')}. ${opts.summary}` });
  }

  // Batch-generate all embeddings
  const embeddings = await generateEmbeddings(fragments.map(f => f.text));

  // Store primary embedding on the memory itself (summary embedding)
  const summaryEmbedding = embeddings[0];
  if (summaryEmbedding) {
    await db
      .from('memories')
      .update({ embedding: JSON.stringify(summaryEmbedding) })
      .eq('id', memoryId);
  }

  // Store all fragments with their embeddings
  const fragmentRows = fragments.map((f, i) => ({
    memory_id: memoryId,
    fragment_type: f.type,
    content: f.text.slice(0, EMBEDDING_FRAGMENT_MAX_LENGTH),
    embedding: embeddings[i] ? JSON.stringify(embeddings[i]) : null,
  })).filter(r => r.embedding !== null);

  if (fragmentRows.length > 0) {
    const { error } = await db.from('memory_fragments').insert(fragmentRows);
    if (error) {
      log.warn({ error: error.message, memoryId }, 'Failed to store memory fragments');
    }
  }

  log.debug({ memoryId, fragments: fragmentRows.length }, 'Memory embedded with fragments');
}

// ---- RECALL ---- //

/**
 * Hybrid retrieval combining vector similarity, keyword matching, and structured scoring.
 *
 * When embeddings are available:
 *   1. Generate query embedding
 *   2. Run vector search (memory-level + fragment-level) for semantic candidates
 *   3. Merge with metadata-filtered candidates from Supabase
 *   4. Score all candidates with enhanced composite formula
 *
 * When embeddings are unavailable:
 *   Falls back to existing keyword + tag + importance scoring.
 *
 * score = (w_recency * recency + w_relevance * relevance + w_importance * importance
 *          + w_vector * vector_similarity) * decay_factor
 */
export async function recallMemories(opts: RecallOptions): Promise<Memory[]> {
  const db = getDb();
  const limit = opts.limit || 5;
  const minDecay = opts.minDecay ?? 0.1;

  try {
    // Phase 1: Vector search for semantic candidates (if available)
    let vectorScores = opts._vectorScores || new Map<number, number>();

    if (opts.query && isEmbeddingEnabled() && !opts._vectorScores) {
      const queryEmbedding = await generateEmbedding(opts.query);
      if (queryEmbedding) {
        // Search both memory-level and fragment-level embeddings
        const [memoryMatches, fragmentMatches] = await Promise.all([
          db.rpc('match_memories', {
            query_embedding: JSON.stringify(queryEmbedding),
            match_threshold: 0.3,
            match_count: limit * 3,
            filter_types: opts.memoryTypes || null,
            filter_user: opts.relatedUser || null,
            min_decay: minDecay,
          }).then(r => r.data || []),
          db.rpc('match_memory_fragments', {
            query_embedding: JSON.stringify(queryEmbedding),
            match_threshold: 0.3,
            match_count: limit * 3,
          }).then(r => r.data || []),
        ]).catch(() => [[], []] as [any[], any[]]);

        // Merge: take highest similarity per memory_id across both sources
        for (const m of memoryMatches) {
          const current = vectorScores.get(m.id) || 0;
          vectorScores.set(m.id, Math.max(current, m.similarity));
        }
        for (const f of fragmentMatches) {
          const current = vectorScores.get(f.memory_id) || 0;
          vectorScores.set(f.memory_id, Math.max(current, f.max_similarity));
        }

        log.debug({
          memoryHits: memoryMatches.length,
          fragmentHits: fragmentMatches.length,
          uniqueMemories: vectorScores.size,
        }, 'Vector search completed');
      }
    }

    // Phase 2: Metadata-filtered candidates from Supabase
    let query = db
      .from('memories')
      .select('*')
      .gte('decay_factor', minDecay)
      .order('importance', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit * 3);

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

    // Phase 3: Merge vector candidates with metadata candidates
    let candidates: Memory[] = data || [];

    // If vector search found memories not in the metadata set, fetch them
    if (vectorScores.size > 0) {
      const metadataIds = new Set(candidates.map(m => m.id));
      const missingIds = [...vectorScores.keys()].filter(id => !metadataIds.has(id));

      if (missingIds.length > 0) {
        const { data: vectorOnly } = await db
          .from('memories')
          .select('*')
          .in('id', missingIds);
        if (vectorOnly) candidates = [...candidates, ...vectorOnly];
      }
    }

    if (candidates.length === 0) return [];

    // Phase 4: Score and rank with enhanced composite formula
    const scoredOpts = vectorScores.size > 0 ? { ...opts, _vectorScores: vectorScores } : opts;
    const scored = candidates.map((mem: Memory) => ({
      ...mem,
      _score: scoreMemory(mem, scoredOpts),
    }));

    scored.sort((a: { _score: number }, b: { _score: number }) => b._score - a._score);
    const results = scored.slice(0, limit);

    // Update access counts in parallel (skip for internal processing like dream cycles)
    if (opts.trackAccess !== false) {
      const ids = results.map((m: Memory) => m.id);
      updateMemoryAccess(ids).catch(err => log.warn({ err }, 'Memory access tracking failed'));
    }

    log.debug({
      recalled: results.length,
      topScore: results[0]?._score?.toFixed(3),
      query: opts.query?.slice(0, 40),
      vectorAssisted: vectorScores.size > 0,
    }, 'Memories recalled');

    return results;
  } catch (err) {
    log.error({ err }, 'Memory recall failed');
    return [];
  }
}

/**
 * Enhanced scoring function with optional vector similarity component.
 *
 * When vector similarity is available:
 *   score = (w_recency * recency + w_relevance * keyword_relevance
 *            + w_importance * importance + w_vector * vector_sim) * decay
 *
 * When not available (graceful fallback):
 *   score = (w_recency * recency + w_relevance * keyword_relevance
 *            + w_importance * importance) * decay
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
    const contentLower = mem.content?.toLowerCase() || '';
    // Check both summary and content for keyword matches
    const matches = queryWords.filter(w =>
      w.length > 2 && (summaryLower.includes(w) || contentLower.includes(w))
    ).length;
    textScore = 0.3 + 0.7 * Math.min(matches / Math.max(queryWords.length, 1), 1);
  }

  // Tag + concept overlap score
  let tagScore = 0.5;
  if (opts.tags && opts.tags.length > 0) {
    const memLabels = [...(mem.tags || []), ...(mem.concepts || [])];
    const overlap = memLabels.filter(t => opts.tags!.includes(t)).length;
    tagScore = 0.5 + 0.5 * Math.min(overlap / opts.tags.length, 1);
  }

  // Relevance: average of text and tag similarity
  const relevance = (textScore + tagScore) / 2;

  // Vector similarity component (0 if not available)
  const vectorSim = opts._vectorScores?.get(mem.id) || 0;

  // Additive formula, gated by decay
  let rawScore =
    RETRIEVAL_WEIGHT_RECENCY * recency +
    RETRIEVAL_WEIGHT_RELEVANCE * relevance +
    RETRIEVAL_WEIGHT_IMPORTANCE * mem.importance;

  // Add vector component when available (highest weight — dominates when present)
  if (vectorSim > 0) {
    rawScore += RETRIEVAL_WEIGHT_VECTOR * vectorSim;
  }

  return rawScore * mem.decay_factor;
}

// ---- PROGRESSIVE DISCLOSURE ---- //

/**
 * Lightweight recall that returns only summaries (~50 tokens each).
 * Use for dream cycle focal point generation, overview scans, and
 * anywhere full content isn't needed. 10x more token-efficient than full recall.
 *
 * Call hydrateMemories() to fetch full content for selected IDs.
 */
export async function recallMemorySummaries(opts: RecallOptions): Promise<MemorySummary[]> {
  const db = getDb();
  const limit = opts.limit || 10;
  const minDecay = opts.minDecay ?? 0.1;

  try {
    let query = db
      .from('memories')
      .select('id, memory_type, summary, tags, concepts, importance, decay_factor, created_at, source')
      .gte('decay_factor', minDecay)
      .order('importance', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);

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
      log.error({ error: error.message }, 'Memory summary recall failed');
      return [];
    }

    return (data || []) as MemorySummary[];
  } catch (err) {
    log.error({ err }, 'Memory summary recall failed');
    return [];
  }
}

/**
 * Fetch full memory content for specific IDs (second stage of progressive disclosure).
 * Use after recallMemorySummaries() to hydrate only the memories you actually need.
 */
export async function hydrateMemories(ids: number[]): Promise<Memory[]> {
  if (ids.length === 0) return [];
  const db = getDb();

  try {
    const { data, error } = await db
      .from('memories')
      .select('*')
      .in('id', ids);

    if (error) {
      log.error({ error: error.message }, 'Memory hydration failed');
      return [];
    }

    return (data || []) as Memory[];
  } catch (err) {
    log.error({ err }, 'Memory hydration failed');
    return [];
  }
}

// ---- ACCESS TRACKING ---- //

async function updateMemoryAccess(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const db = getDb();

  // Batch update in parallel instead of sequential loop
  await Promise.all(ids.map(async (id) => {
    const { data: current } = await db
      .from('memories')
      .select('access_count, decay_factor')
      .eq('id', id)
      .single();

    // Boost decay on access (not full reset — gradual reinforcement)
    const currentDecay = current?.decay_factor ?? 0.5;
    const boostedDecay = Math.min(1.0, currentDecay + 0.1);

    await db
      .from('memories')
      .update({
        access_count: (current?.access_count || 0) + 1,
        last_accessed: new Date().toISOString(),
        decay_factor: boostedDecay,
      })
      .eq('id', id);
  }));
}

// ---- DECAY ---- //

/**
 * Apply type-specific memory decay.
 * Episodic memories fade fastest (0.93/day), self-model slowest (0.99/day).
 * This mirrors human cognition: events are forgotten but identity persists.
 */
export async function decayMemories(): Promise<number> {
  const db = getDb();

  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await db
      .from('memories')
      .select('id, memory_type, decay_factor')
      .lt('last_accessed', cutoff)
      .gt('decay_factor', MEMORY_MIN_DECAY);

    if (error || !data) return 0;

    let decayed = 0;
    for (const mem of data) {
      const rate = DECAY_RATES[mem.memory_type] ?? 0.95;
      const newDecay = Math.max(mem.decay_factor * rate, MEMORY_MIN_DECAY);
      await db
        .from('memories')
        .update({ decay_factor: newDecay })
        .eq('id', mem.id);
      decayed++;
    }

    if (decayed > 0) {
      log.info({ decayed }, 'Type-specific memory decay applied');
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
  topConcepts: { concept: string; count: number }[];
  embeddedCount: number;
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
    topConcepts: [],
    embeddedCount: 0,
  };

  try {
    const { data: memories } = await db
      .from('memories')
      .select('memory_type, importance, decay_factor, created_at, related_user, tags, concepts, embedding')
      .gt('decay_factor', MEMORY_MIN_DECAY);

    if (memories && memories.length > 0) {
      stats.total = memories.length;

      let impSum = 0;
      let decaySum = 0;
      const tagCounts: Record<string, number> = {};
      const conceptCounts: Record<string, number> = {};
      const users = new Set<string>();

      for (const m of memories) {
        const type = m.memory_type as MemoryType;
        if (type in stats.byType) stats.byType[type]++;
        impSum += m.importance;
        decaySum += m.decay_factor;
        if (m.related_user) users.add(m.related_user);
        if (m.embedding) stats.embeddedCount++;
        if (m.tags) {
          for (const tag of m.tags) {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
          }
        }
        if (m.concepts) {
          for (const concept of m.concepts) {
            conceptCounts[concept] = (conceptCounts[concept] || 0) + 1;
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

      stats.topConcepts = Object.entries(conceptCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([concept, count]) => ({ concept, count }));

      const sorted = memories.map(m => m.created_at).sort();
      stats.oldestMemory = sorted[0] || null;
      stats.newestMemory = sorted[sorted.length - 1] || null;
    }

    const { count, error: dreamError } = await db
      .from('dream_logs')
      .select('id', { count: 'exact', head: true });
    if (dreamError) {
      log.warn({ error: dreamError.message }, 'Failed to count dream logs');
    }
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
