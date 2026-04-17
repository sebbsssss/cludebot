# Benchmark Results — Clude Hackathon Submission

> **Last updated:** [FILL ON DAY 5 — 2026-04-22]
> **Submission:** Colosseum Frontier 2026
> **Reproducibility:** all configs, raw outputs, and runner scripts in this repo. See [DEMO.md](./DEMO.md) for end-to-end reproduction.

## Methodology

We use [MemoryAgentBench](https://arxiv.org/abs/2507.05257) (ICLR 2026) — the academic state-of-the-art for memory-system benchmarks — as the rigorous core. All systems are tested against the same underlying LLM (`gpt-4o-mini`) so we measure *memory systems*, not model quality.

Three of four MemoryAgentBench competencies are run:
- **AR** (Accurate Retrieval)
- **LRU** (Long-Range Understanding)
- **CR** (Conflict Resolution)

Test-Time Learning (TTL) is omitted to fit the 10-day timeline; this is disclosed in [HONEST_LIMITATIONS.md](./HONEST_LIMITATIONS.md).

## Systems Compared

| System | Type | Version | API/Local |
|---|---|---|---|
| Clude | Graph + temporal + dream cycle | 2.7.8 | Self-hosted (this repo) |
| mem0 | Hybrid memory | [FILL] | API |
| Letta (MemGPT) | Agentic memory | [FILL] | API |
| Zep | Production memory layer | [FILL] | API |
| Cognee | Graph-based RAG | [FILL] | Local |
| BM25 | Keyword baseline | — | Local |
| text-embedding-3-large RAG | Pure-vector baseline | — | OpenAI API |
| gpt-4o-mini (no memory) | LLM-only baseline | — | OpenAI API |

## MemoryAgentBench Results

[FILL ON DAY 5 — Run `scripts/benchmark/collect-results.ts` and paste the table here]

| System | AR | LRU | CR | Average |
|---|---|---|---|---|
| Clude | — | — | — | — |
| Zep | — | — | — | — |
| mem0 | — | — | — | — |
| Letta | — | — | — | — |
| Cognee | — | — | — | — |
| Embedding RAG | — | — | — | — |
| BM25 | — | — | — | — |
| No memory | — | — | — | — |

## Novel Test: Verifiable Provenance Recall

A test no current benchmark measures: at query time, can the system return both the correct historical fact AND a cryptographic proof of provenance (on-chain attestation hash)?

This test exists because Clude built a capability no competitor has. We are **not** claiming competitors fail it — we are proposing this is the next axis memory benchmarks should measure.

**Result:** Clude — pass (provides both correct fact + Solana devnet tx hash on every query). Competitors — n/a (no provenance layer).

## Consumer Side-by-Side (Illustrative)

10 multi-session user journeys hand-scripted and run through:
- ChatGPT (memory ON)
- Claude.ai (with Projects/memory)
- gpt-4o-mini + Clude SDK

Scored blind via judge LLM + one human pass.

**Sample size: 10. Labeled illustrative, not statistically rigorous.** MemoryAgentBench is the rigorous part.

| System | Correct (n=10) |
|---|---|
| Clude + gpt-4o-mini | — / 10 |
| ChatGPT (memory on) | — / 10 |
| Claude.ai (Projects) | — / 10 |

## Reproduction

```bash
# Clone
git clone https://github.com/sebbsssss/cludebot
cd cludebot && git checkout feat/hackathon-colosseum

# Stand up Clude (Supabase + Anthropic key required — see README)
npm install && npm run build:sdk

# Run MemoryAgentBench
cd experiments/MemoryAgentBench
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
bash ../../scripts/benchmark/run-all-competitors.sh

# Collect results
npx tsx ../../scripts/benchmark/collect-results.ts
```
