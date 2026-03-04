/**
 * EMBEDDING PROVIDER BENCHMARK
 *
 * Compares Voyage AI, OpenAI, and Venice embedding providers across all
 * production memories. Read-only — no DB writes.
 *
 * Usage: npx tsx scripts/embedding-benchmark.ts
 *   or:  railway run --service cluude-bot -- npx tsx scripts/embedding-benchmark.ts
 */
import dotenv from 'dotenv';
dotenv.config();

// ── Types ─────────────────────────────────────────────────────

interface ProviderSpec {
  name: string;
  apiKey: string;
  url: string;
  model: string;
  supportsDimensions: boolean;
}

interface MemoryRow {
  id: number;
  summary: string;
  content: string;
  tags: string[] | null;
  concepts: string[] | null;
  related_user: string | null;
  memory_type: string;
  importance: number;
}

interface EmbeddingResult {
  provider: string;
  embeddings: Map<number, number[]>;
  totalTimeMs: number;
  failures: number;
  dimensions: number;
}

interface TestQuery {
  query: string;
  keywords: string[];
  tags: string[];
  relatedUser?: string;
}

interface QueryResult {
  query: string;
  rankedIds: number[];
  similarities: number[];
  latencyMs: number;
}

interface ProviderMetrics {
  provider: string;
  memoryCount: number;
  embedTimeMs: number;
  embedRate: number;
  failures: number;
  precisionAt1: number;
  precisionAt3: number;
  precisionAt5: number;
  precisionAt10: number;
  mrr: number;
  avgQueryLatencyMs: number;
  p50QueryLatencyMs: number;
  p95QueryLatencyMs: number;
  queryResults: QueryResult[];
}

// ── Config ────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const PROVIDER_CONFIGS: Record<string, { url: string; defaultModel: string }> = {
  voyage:  { url: 'https://api.voyageai.com/v1/embeddings', defaultModel: 'voyage-4-large' },
  openai:  { url: 'https://api.openai.com/v1/embeddings',   defaultModel: 'text-embedding-3-small' },
  venice:  { url: 'https://api.venice.ai/api/v1/embeddings', defaultModel: 'text-embedding-3-small' },
};

const TARGET_DIMS = 1024;
const BATCH_SIZE = 50;
const RELEVANCE_THRESHOLD = 2.0;

// ── Provider Detection ────────────────────────────────────────

function detectProviders(): ProviderSpec[] {
  const specs: ProviderSpec[] = [];
  const seen = new Set<string>();

  // Configured provider
  const configuredProvider = process.env.EMBEDDING_PROVIDER || '';
  const configuredKey = process.env.EMBEDDING_API_KEY || '';
  if (configuredProvider && configuredKey && PROVIDER_CONFIGS[configuredProvider]) {
    const cfg = PROVIDER_CONFIGS[configuredProvider];
    specs.push({
      name: configuredProvider,
      apiKey: configuredKey,
      url: cfg.url,
      model: process.env.EMBEDDING_MODEL || cfg.defaultModel,
      supportsDimensions: configuredProvider !== 'voyage',
    });
    seen.add(configuredProvider);
  }

  // OpenAI fallback
  const openaiKey = process.env.OPENAI_API_KEY || '';
  if (openaiKey && !seen.has('openai')) {
    specs.push({
      name: 'openai',
      apiKey: openaiKey,
      url: PROVIDER_CONFIGS.openai.url,
      model: PROVIDER_CONFIGS.openai.defaultModel,
      supportsDimensions: true,
    });
    seen.add('openai');
  }

  // Venice fallback
  const veniceKey = process.env.VENICE_API_KEY || '';
  if (veniceKey && !seen.has('venice')) {
    specs.push({
      name: 'venice',
      apiKey: veniceKey,
      url: PROVIDER_CONFIGS.venice.url,
      model: PROVIDER_CONFIGS.venice.defaultModel,
      supportsDimensions: true,
    });
    seen.add('venice');
  }

  return specs;
}

// ── Helpers ───────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function pad(s: string, w: number): string {
  return s.padEnd(w);
}

function padR(s: string, w: number): string {
  return s.padStart(w);
}

// ── Supabase (read-only) ─────────────────────────────────────

async function supabaseGet<T>(path: string): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'GET',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase GET: ${res.status} ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function fetchAllMemories(): Promise<MemoryRow[]> {
  const all: MemoryRow[] = [];
  let offset = 0;
  const PAGE = 500;
  while (true) {
    const batch = await supabaseGet<MemoryRow[]>(
      `memories?select=id,summary,content,tags,concepts,related_user,memory_type,importance` +
      `&decay_factor=gte.0.1&order=id.asc&offset=${offset}&limit=${PAGE}`
    );
    if (!batch || batch.length === 0) break;
    all.push(...batch);
    offset += PAGE;
    if (batch.length < PAGE) break;
  }
  return all;
}

// ── Embedding API ─────────────────────────────────────────────

async function batchEmbed(
  provider: ProviderSpec,
  texts: string[],
  retries = 3,
): Promise<(number[] | null)[]> {
  const body: any = {
    input: texts.map(t => t.slice(0, 8000)),
    model: provider.model,
  };
  if (provider.supportsDimensions) {
    body.dimensions = TARGET_DIMS;
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(provider.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${provider.apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (res.status === 429) {
        const waitMs = Math.pow(2, attempt) * 1000 + Math.random() * 500;
        process.stdout.write(` [429 wait ${(waitMs / 1000).toFixed(1)}s]`);
        await sleep(waitMs);
        continue;
      }

      if (!res.ok) {
        const errText = await res.text();
        console.error(`\n  [${provider.name}] API error ${res.status}: ${errText.slice(0, 200)}`);
        return texts.map(() => null);
      }

      const data = await res.json() as { data: Array<{ embedding: number[]; index: number }> };
      const result: (number[] | null)[] = texts.map(() => null);
      for (const item of data.data || []) {
        result[item.index] = item.embedding;
      }
      return result;
    } catch (err: any) {
      if (attempt === retries) {
        console.error(`\n  [${provider.name}] Failed after ${retries} retries: ${err.message}`);
        return texts.map(() => null);
      }
      await sleep(Math.pow(2, attempt) * 1000);
    }
  }
  return texts.map(() => null);
}

async function embedAllMemories(
  provider: ProviderSpec,
  memories: MemoryRow[],
): Promise<EmbeddingResult> {
  const embeddings = new Map<number, number[]>();
  let failures = 0;
  const startMs = Date.now();

  for (let i = 0; i < memories.length; i += BATCH_SIZE) {
    const batch = memories.slice(i, i + BATCH_SIZE);
    const texts = batch.map(m => (m.summary || m.content || '').slice(0, 8000));
    const results = await batchEmbed(provider, texts);

    for (let j = 0; j < batch.length; j++) {
      if (results[j]) {
        embeddings.set(batch[j].id, results[j]!);
      } else {
        failures++;
      }
    }

    const done = Math.min(i + BATCH_SIZE, memories.length);
    process.stdout.write(`\r  [${provider.name}] ${done}/${memories.length} embedded`);
    await sleep(100);
  }
  process.stdout.write('\n');

  const dims = embeddings.size > 0 ? [...embeddings.values()][0].length : 0;
  return {
    provider: provider.name,
    embeddings,
    totalTimeMs: Date.now() - startMs,
    failures,
    dimensions: dims,
  };
}

async function embedSingle(
  provider: ProviderSpec,
  text: string,
): Promise<{ embedding: number[] | null; latencyMs: number }> {
  const start = Date.now();
  const results = await batchEmbed(provider, [text]);
  return { embedding: results[0], latencyMs: Date.now() - start };
}

// ── Cosine Similarity ─────────────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function rankMemories(
  queryEmbedding: number[],
  memoryEmbeddings: Map<number, number[]>,
  topK: number = 10,
): { id: number; similarity: number }[] {
  const scored: { id: number; similarity: number }[] = [];
  for (const [id, emb] of memoryEmbeddings) {
    scored.push({ id, similarity: cosineSimilarity(queryEmbedding, emb) });
  }
  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, topK);
}

// ── Ground Truth Heuristic ────────────────────────────────────

function computeRelevanceScore(memory: MemoryRow, tq: TestQuery): number {
  let score = 0;
  const summaryLower = (memory.summary || '').toLowerCase();
  const contentLower = (memory.content || '').toLowerCase();

  for (const kw of tq.keywords) {
    const kwL = kw.toLowerCase();
    if (summaryLower.includes(kwL)) score += 2;
    else if (contentLower.includes(kwL)) score += 1;
  }

  const memTags = new Set((memory.tags || []).map(t => t.toLowerCase()));
  for (const tag of tq.tags) {
    if (memTags.has(tag.toLowerCase())) score += 1.5;
  }

  if (tq.relatedUser && memory.related_user === tq.relatedUser) {
    score += 2;
  }

  const memConcepts = new Set((memory.concepts || []).map(c => c.toLowerCase()));
  for (const kw of tq.keywords) {
    if (memConcepts.has(kw.toLowerCase())) score += 1;
  }

  return score;
}

function getRelevantIds(memories: MemoryRow[], tq: TestQuery): Set<number> {
  const ids = new Set<number>();
  for (const m of memories) {
    if (computeRelevanceScore(m, tq) >= RELEVANCE_THRESHOLD) {
      ids.add(m.id);
    }
  }
  return ids;
}

// ── Metrics ───────────────────────────────────────────────────

function precisionAtK(rankedIds: number[], relevantIds: Set<number>, k: number): number {
  if (relevantIds.size === 0) return 0;
  const topK = rankedIds.slice(0, k);
  const hits = topK.filter(id => relevantIds.has(id)).length;
  return hits / Math.min(k, relevantIds.size);
}

function reciprocalRank(rankedIds: number[], relevantIds: Set<number>): number {
  for (let i = 0; i < rankedIds.length; i++) {
    if (relevantIds.has(rankedIds[i])) return 1 / (i + 1);
  }
  return 0;
}

function spearmanRho(ranking1: number[], ranking2: number[]): number {
  const allIds = new Set([...ranking1, ...ranking2]);
  const n = allIds.size;
  if (n < 2) return 1;

  const rank1 = new Map<number, number>();
  const rank2 = new Map<number, number>();
  ranking1.forEach((id, i) => rank1.set(id, i + 1));
  ranking2.forEach((id, i) => rank2.set(id, i + 1));

  const penalty = Math.max(ranking1.length, ranking2.length) + 1;
  let sumD2 = 0;
  for (const id of allIds) {
    const r1 = rank1.get(id) ?? penalty;
    const r2 = rank2.get(id) ?? penalty;
    sumD2 += (r1 - r2) ** 2;
  }
  return 1 - (6 * sumD2) / (n * (n * n - 1));
}

// ── Test Queries ──────────────────────────────────────────────

const TEST_QUERIES: TestQuery[] = [
  // User-specific
  { query: 'what does alice think about staking', keywords: ['alice', 'staking', 'stake'], tags: ['staking'], relatedUser: 'alice' },
  { query: "bob's NFT collection and art", keywords: ['bob', 'nft', 'collection', 'art'], tags: ['nft'], relatedUser: 'bob' },
  { query: 'who are the most active community members', keywords: ['community', 'active', 'member', 'engagement'], tags: ['community'] },

  // Topic-based
  { query: 'SOL staking yields and APY', keywords: ['staking', 'yield', 'apy', 'sol', 'validator'], tags: ['staking', 'solana', 'defi'] },
  { query: 'market crash and price dump', keywords: ['crash', 'dump', 'price', 'market', 'panic'], tags: ['market', 'crash'] },
  { query: 'DeFi strategies on Solana', keywords: ['defi', 'strategy', 'liquidity', 'farming', 'solana'], tags: ['defi', 'solana'] },
  { query: 'meme token culture and trends', keywords: ['meme', 'culture', 'trend', 'token'], tags: ['meme', 'culture'] },
  { query: 'NFT market and digital art', keywords: ['nft', 'art', 'collection', 'digital', 'mint'], tags: ['nft', 'art'] },
  { query: 'liquidity pool performance and fees', keywords: ['liquidity', 'pool', 'lp', 'swap', 'fee'], tags: ['defi', 'liquidity'] },
  { query: 'airdrop farming and token distribution', keywords: ['airdrop', 'farming', 'distribution', 'claim'], tags: ['airdrop'] },

  // Entity-based
  { query: 'tell me about marinade finance staking', keywords: ['marinade', 'msol', 'liquid', 'staking'], tags: ['marinade', 'staking'] },
  { query: 'what is $CLUDE and its community', keywords: ['clude', 'token', 'community', 'meme', 'sentient'], tags: ['clude', 'meme'] },
  { query: 'jupiter exchange swaps and DEX', keywords: ['jupiter', 'jup', 'swap', 'exchange', 'dex'], tags: ['jupiter', 'defi'] },
  { query: 'solana ecosystem and network health', keywords: ['solana', 'sol', 'network', 'ecosystem', 'chain'], tags: ['solana'] },

  // Broad/behavioral
  { query: 'community sentiment bullish or bearish', keywords: ['sentiment', 'mood', 'bullish', 'bearish', 'community'], tags: ['sentiment'] },
  { query: 'whale activity and large transfers', keywords: ['whale', 'transfer', 'large', 'movement', 'wallet'], tags: ['whale'] },
  { query: 'token price action and volume', keywords: ['price', 'chart', 'pump', 'dump', 'volume', 'mcap'], tags: ['price', 'market'] },
  { query: 'my identity and self reflection', keywords: ['identity', 'self', 'who', 'becoming', 'evolving'], tags: ['identity', 'self'] },
  { query: 'what patterns have I noticed recently', keywords: ['pattern', 'trend', 'recurring', 'notice', 'observe'], tags: ['pattern'] },
  { query: 'on-chain transactions and wallet movements', keywords: ['transaction', 'wallet', 'on-chain', 'transfer', 'signature'], tags: ['wallet', 'transaction'] },
];

// ── Reporting ─────────────────────────────────────────────────

function printReport(allMetrics: ProviderMetrics[], allQueryResults: Map<string, QueryResult[]>) {
  const providerCount = allMetrics.length;
  const memCount = allMetrics[0]?.memoryCount ?? 0;

  console.log(`
\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557
\u2551     EMBEDDING PROVIDER BENCHMARK              \u2551
\u2551     ${pad(`${memCount.toLocaleString()} memories \u00d7 ${providerCount} provider${providerCount > 1 ? 's' : ''}`, 42)}\u2551
\u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255d
`);

  // ── Throughput
  console.log('\u2500\u2500 Embedding Throughput \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
  console.log(`  ${pad('Provider', 12)} | ${padR('Memories', 8)} | ${padR('Time', 8)} | ${padR('Rate', 10)} | ${padR('Fails', 5)} | ${padR('Dims', 5)}`);
  console.log(`  ${'\u2500'.repeat(12)} | ${'\u2500'.repeat(8)} | ${'\u2500'.repeat(8)} | ${'\u2500'.repeat(10)} | ${'\u2500'.repeat(5)} | ${'\u2500'.repeat(5)}`);
  for (const m of allMetrics) {
    console.log(`  ${pad(m.provider, 12)} | ${padR(String(m.memoryCount), 8)} | ${padR(`${(m.embedTimeMs / 1000).toFixed(1)}s`, 8)} | ${padR(`${m.embedRate.toFixed(1)}/s`, 10)} | ${padR(String(m.failures), 5)} | ${padR(String(allMetrics.find(x => x.provider === m.provider) ? '1024' : '?'), 5)}`);
  }
  console.log();

  // ── Recall Quality
  console.log('\u2500\u2500 Recall Quality (20 queries, top-10) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
  console.log(`  ${pad('Provider', 12)} | ${padR('P@1', 7)} | ${padR('P@3', 7)} | ${padR('P@5', 7)} | ${padR('P@10', 7)} | ${padR('MRR', 7)}`);
  console.log(`  ${'\u2500'.repeat(12)} | ${'\u2500'.repeat(7)} | ${'\u2500'.repeat(7)} | ${'\u2500'.repeat(7)} | ${'\u2500'.repeat(7)} | ${'\u2500'.repeat(7)}`);
  for (const m of allMetrics) {
    console.log(`  ${pad(m.provider, 12)} | ${padR(`${(m.precisionAt1 * 100).toFixed(1)}%`, 7)} | ${padR(`${(m.precisionAt3 * 100).toFixed(1)}%`, 7)} | ${padR(`${(m.precisionAt5 * 100).toFixed(1)}%`, 7)} | ${padR(`${(m.precisionAt10 * 100).toFixed(1)}%`, 7)} | ${padR(m.mrr.toFixed(3), 7)}`);
  }
  console.log();

  // ── Query Latency
  console.log('\u2500\u2500 Query Embedding Latency \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
  console.log(`  ${pad('Provider', 12)} | ${padR('Avg', 8)} | ${padR('P50', 8)} | ${padR('P95', 8)}`);
  console.log(`  ${'\u2500'.repeat(12)} | ${'\u2500'.repeat(8)} | ${'\u2500'.repeat(8)} | ${'\u2500'.repeat(8)}`);
  for (const m of allMetrics) {
    console.log(`  ${pad(m.provider, 12)} | ${padR(`${m.avgQueryLatencyMs.toFixed(0)}ms`, 8)} | ${padR(`${m.p50QueryLatencyMs.toFixed(0)}ms`, 8)} | ${padR(`${m.p95QueryLatencyMs.toFixed(0)}ms`, 8)}`);
  }
  console.log();

  // ── Provider Agreement
  if (allMetrics.length >= 2) {
    console.log('\u2500\u2500 Provider Agreement (Spearman \u03c1) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
    const names = allMetrics.map(m => m.provider);
    console.log(`  ${pad('', 12)}   ${names.map(n => padR(n, 8)).join('   ')}`);
    for (let i = 0; i < names.length; i++) {
      const row = names.map((_, j) => {
        if (i === j) return padR('1.000', 8);
        const qr1 = allQueryResults.get(names[i]) || [];
        const qr2 = allQueryResults.get(names[j]) || [];
        let totalRho = 0;
        let count = 0;
        for (let q = 0; q < TEST_QUERIES.length; q++) {
          if (qr1[q] && qr2[q]) {
            totalRho += spearmanRho(qr1[q].rankedIds, qr2[q].rankedIds);
            count++;
          }
        }
        const avgRho = count > 0 ? totalRho / count : 0;
        return padR(avgRho.toFixed(3), 8);
      });
      console.log(`  ${pad(names[i], 12)}   ${row.join('   ')}`);
    }
    console.log();
  }

  // ── Winner
  console.log('\u2500\u2500 Summary \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
  const bestQuality = [...allMetrics].sort((a, b) => b.mrr - a.mrr)[0];
  const bestSpeed = [...allMetrics].sort((a, b) => b.embedRate - a.embedRate)[0];
  const bestLatency = [...allMetrics].sort((a, b) => a.avgQueryLatencyMs - b.avgQueryLatencyMs)[0];
  console.log(`  Best quality:       ${bestQuality.provider} (MRR ${bestQuality.mrr.toFixed(3)}, P@1 ${(bestQuality.precisionAt1 * 100).toFixed(1)}%)`);
  console.log(`  Best throughput:    ${bestSpeed.provider} (${bestSpeed.embedRate.toFixed(1)} memories/s)`);
  console.log(`  Best query latency: ${bestLatency.provider} (avg ${bestLatency.avgQueryLatencyMs.toFixed(0)}ms)`);
  console.log();
}

// ── Main ──────────────────────────────────────────────────────

async function main() {
  const providers = detectProviders();

  if (providers.length === 0) {
    console.error('No embedding providers detected. Set EMBEDDING_PROVIDER + EMBEDDING_API_KEY, OPENAI_API_KEY, or VENICE_API_KEY.');
    process.exit(1);
  }

  console.log(`\nDetected providers: ${providers.map(p => p.name).join(', ')}\n`);

  // Fetch all memories
  console.log('Fetching memories from Supabase...');
  const memories = await fetchAllMemories();
  console.log(`  Loaded ${memories.length} memories\n`);

  if (memories.length === 0) {
    console.error('No memories found.');
    process.exit(1);
  }

  // Pre-compute ground truth for all queries
  const groundTruth = new Map<string, Set<number>>();
  for (const tq of TEST_QUERIES) {
    groundTruth.set(tq.query, getRelevantIds(memories, tq));
  }

  // Show ground truth coverage
  console.log('Ground truth coverage:');
  for (const tq of TEST_QUERIES) {
    const relevant = groundTruth.get(tq.query)!;
    console.log(`  "${tq.query.slice(0, 45)}..." → ${relevant.size} relevant`);
  }
  console.log();

  // Run benchmark per provider
  const allMetrics: ProviderMetrics[] = [];
  const allQueryResults = new Map<string, QueryResult[]>();

  for (const provider of providers) {
    console.log(`\u2501\u2501 ${provider.name.toUpperCase()} (${provider.model}) \u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501`);

    // Embed all memories
    const embedResult = await embedAllMemories(provider, memories);

    if (embedResult.dimensions !== TARGET_DIMS && embedResult.dimensions > 0) {
      console.log(`  \u26a0 Dimensions: ${embedResult.dimensions} (expected ${TARGET_DIMS})`);
    }

    if (embedResult.embeddings.size === 0) {
      console.log(`  \u2717 No embeddings generated, skipping recall test`);
      continue;
    }

    console.log(`  Embedded ${embedResult.embeddings.size} memories in ${(embedResult.totalTimeMs / 1000).toFixed(1)}s (${(embedResult.embeddings.size / (embedResult.totalTimeMs / 1000)).toFixed(1)}/s)`);

    // Run queries
    const queryResults: QueryResult[] = [];
    const queryLatencies: number[] = [];

    for (const tq of TEST_QUERIES) {
      const { embedding: qEmb, latencyMs } = await embedSingle(provider, tq.query);
      queryLatencies.push(latencyMs);

      if (!qEmb) {
        queryResults.push({ query: tq.query, rankedIds: [], similarities: [], latencyMs });
        continue;
      }

      const ranked = rankMemories(qEmb, embedResult.embeddings, 10);
      queryResults.push({
        query: tq.query,
        rankedIds: ranked.map(r => r.id),
        similarities: ranked.map(r => r.similarity),
        latencyMs,
      });

      await sleep(50); // courtesy delay
    }

    // Compute metrics
    let sumP1 = 0, sumP3 = 0, sumP5 = 0, sumP10 = 0, sumMRR = 0;
    let validQueries = 0;

    for (let i = 0; i < TEST_QUERIES.length; i++) {
      const tq = TEST_QUERIES[i];
      const qr = queryResults[i];
      const relevant = groundTruth.get(tq.query)!;

      if (relevant.size === 0 || qr.rankedIds.length === 0) continue;
      validQueries++;

      sumP1 += precisionAtK(qr.rankedIds, relevant, 1);
      sumP3 += precisionAtK(qr.rankedIds, relevant, 3);
      sumP5 += precisionAtK(qr.rankedIds, relevant, 5);
      sumP10 += precisionAtK(qr.rankedIds, relevant, 10);
      sumMRR += reciprocalRank(qr.rankedIds, relevant);
    }

    const sortedLatencies = [...queryLatencies].sort((a, b) => a - b);

    const metrics: ProviderMetrics = {
      provider: provider.name,
      memoryCount: embedResult.embeddings.size,
      embedTimeMs: embedResult.totalTimeMs,
      embedRate: embedResult.embeddings.size / (embedResult.totalTimeMs / 1000),
      failures: embedResult.failures,
      precisionAt1: validQueries > 0 ? sumP1 / validQueries : 0,
      precisionAt3: validQueries > 0 ? sumP3 / validQueries : 0,
      precisionAt5: validQueries > 0 ? sumP5 / validQueries : 0,
      precisionAt10: validQueries > 0 ? sumP10 / validQueries : 0,
      mrr: validQueries > 0 ? sumMRR / validQueries : 0,
      avgQueryLatencyMs: queryLatencies.reduce((a, b) => a + b, 0) / queryLatencies.length,
      p50QueryLatencyMs: percentile(sortedLatencies, 50),
      p95QueryLatencyMs: percentile(sortedLatencies, 95),
      queryResults,
    };

    allMetrics.push(metrics);
    allQueryResults.set(provider.name, queryResults);
    console.log();
  }

  // Print final report
  if (allMetrics.length > 0) {
    printReport(allMetrics, allQueryResults);
  } else {
    console.error('No providers produced results.');
  }
}

main().catch(err => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
