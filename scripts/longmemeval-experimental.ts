/**
 * Experimental LongMemEval Benchmark
 *
 * Thin wrapper around longmemeval-benchmark.ts that monkey-patches
 * Cortex.recall to use enhancedRecallMemories() from src/experimental/.
 *
 * Tier 1 experiments: Temporal Bonds (Exp 9) + Confidence Gate (Exp 6).
 * Reranking (Exp 3) skipped — no COHERE_API_KEY available.
 *
 * Usage: npx tsx scripts/longmemeval-experimental.ts [same flags as longmemeval-benchmark.ts]
 */

// Set experimental feature flags before any imports
process.env.EXP_TEMPORAL_BONDS = 'true';
process.env.EXP_CONFIDENCE_GATE = 'false';
process.env.EXP_RERANKING = 'false';
process.env.EXP_IRCOT = 'false';
process.env.EXP_RRF_MERGE = 'false';
process.env.EXP_BM25_SEARCH = 'false';

async function run() {
  // Dynamic imports so env vars are set before module initialization
  const { Cortex } = await import('../src/sdk');
  const { enhancedRecallMemories } = await import('../src/experimental/enhanced-recall');

  // Monkey-patch Cortex.recall to use enhanced pipeline
  Cortex.prototype.recall = async function (opts: any = {}): Promise<any[]> {
    (this as any).guard();
    const result = await enhancedRecallMemories(opts);
    return result.memories;
  };

  console.log('[EXPERIMENTAL] Enhanced recall active: temporal_bonds (confidence_gate OFF)');
  console.log();

  // Import the benchmark — auto-runs main()
  await import('./longmemeval-benchmark');
}

run();
