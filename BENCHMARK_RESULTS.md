# Benchmark Results — Clude Hackathon Submission

> **Last updated:** 2026-04-21
> **Submission:** Colosseum Frontier 2026
> **Reproducibility:** all configs, raw outputs, and runner scripts in this repo. See [DEMO.md](./DEMO.md) for end-to-end reproduction.

## Methodology

We run two benchmark families:

1. **MemoryAgentBench** ([ICLR 2026](https://arxiv.org/abs/2507.05257)) — the academic state-of-the-art for memory-system benchmarks. Three of four competencies: AR (Accurate Retrieval), LRU (Long-Range Understanding), CR (Conflict Resolution). TTL omitted for 10-day timeline — disclosed in [HONEST_LIMITATIONS.md](./HONEST_LIMITATIONS.md).
2. **Multi-hop QA** — the three benchmarks Cognee uses (HotPotQA, 2WikiMultiHop, MuSiQue). Standalone runner at `scripts/benchmark/run-multihop.py`, same Clude adapter, same scoring functions as Cognee.

All Clude runs use `gpt-4o-mini` as the answer LLM. Earlier results where Clude was accidentally running on Sonnet have been invalidated and discarded — fair comparison requires a fixed model.

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

## MemoryAgentBench Results — Clude first row (other systems pending tomorrow's retry fixes)

All scores reported as percentages. n = number of Q/A pairs evaluated (glob datasets expand beyond `max_test_samples: 25`).

| System | AR (n=300) | LRU (n=71) | CR (n=100) |
|---|---|---|---|
| **Clude + gpt-4o-mini** | EM 1.3  /  F1 13.4  /  recall 24.4 | EM 0.0  /  substring 59.2  /  recall 73.6 | EM 55.0  /  F1 56.4  /  recall 56.3 |
| **BM25 + gpt-4o-mini** | **EM 6.0  /  F1 25.0  /  recall 47.8** | **EM 0.0  /  substring 60.6  /  recall 78.3** | **EM 80.0  /  F1 81.4  /  recall 81.3** |
| mem0 + gpt-4o-mini | 🏃 running | queued | queued |
| Letta-API + gpt-4o-mini | queued | queued | queued |
| Embedding RAG (text-embedding-3-large) | pending (faiss fix) | pending | pending |
| No-memory baseline (gpt-4o-mini alone) | failed (TPM) — retry | queued | queued |

**Honest read of the MABench rows:**

- **BM25 wins all three MABench competencies.** This is a real finding, not a bug. BM25's literal keyword match is more precise than Clude's graph expansion when the benchmark answers are single-token exact facts in relatively short passages.
- Clude's **CR 55% / BM25's 80%** gap is the most striking. Factconsolidation_sh_6k has 6k-token contexts where BM25's precision wins. Clude's dream-cycle graph adds useful structure *over longer horizons*, but the benchmark passages are too short for that edge to materialize.
- Clude's **AR 1.3%** is low because LongMemEval_s's 400k-token haystacks are where single-session retrieval from a memory graph is especially hard — the graph has to re-index everything on every question. On the *same dataset*, a different evaluation (LongMemEval's native judge-based scoring at n=500) is re-running under `scripts/longmemeval-benchmark-openai.ts` — that number will land separately.

## Multi-hop Results (Cognee benchmark family)

Standard HotPotQA-style scoring (exact_match, token-F1, substring match). All runs at n=50, gpt-4o-mini answerer.

| Dataset | Clude | BM25 | Delta |
|---|---|---|---|
| HotPotQA (dev distractor) | EM **62.0**  F1 **75.5**  SUB 72.0 | EM 58.0  F1 72.7  SUB 72.0 | Clude +4 EM |
| 2WikiMultiHop | EM 58.0  F1 **68.2**  SUB 72.0 | EM 58.0  F1 66.4  SUB 72.0 | tie (Clude +1.8 F1) |
| MuSiQue (ans dev) | EM 20.0  F1 33.8  SUB 28.0 | EM **26.0**  F1 **44.7**  SUB **38.0** | BM25 +6 EM |

**Honest read of the multi-hop rows:**

Across six datasets (3 MABench + 3 multi-hop), BM25 wins four, Clude wins one (HotPot), and one is tied (2Wiki). **This is not a story about Clude beating keyword retrieval on academic benchmarks.** It is a story about *what the benchmarks actually test vs. what Clude is designed for*:

- These benchmarks feed the system a context block at question time. They test *within-context retrieval* — essentially "given these documents, find the answer."
- Clude is designed for the *cross-session* case — memory that accumulates, decays, resolves contradictions, and retains provenance over weeks or months of conversation. None of these benchmarks put the memory through that regime.

For the cross-session regime, we ran three benchmarks more aligned with Clude's thesis:

## Cross-session / Personalization Benchmarks

| Benchmark | What it tests | Clude result | Status |
|---|---|---|---|
| **LongMemEval** (S-variant, n=500) | Long-term chat memory across sessions | **[run in progress — PID 1741]** | gpt-4o-mini reader via shim; ETA 6-12 hrs |
| **PERMA** (MINE-USTC, n=10 country users) | Preference consistency across multi-session multi-domain interactions | **[run in progress — PID 6020]** | ETA 2-4 hrs |
| **AMemGym** (AGI-Eval) | Conversational memory, Write/Read/Utilization diagnostics | **[integration in progress]** | subagent working |
| *Prior: LongMemEval with Sonnet reader (Feb 2026)* | Same as above, different LLM | **80.4% (Phase 3 judge)** | committed to repo, different LLM so not apples-to-apples with the above |

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

# Run multi-hop QA benchmarks (Clude only)
# Requires clude-adapter running: npx tsx clude-adapter/server.ts
python ../../scripts/benchmark/run-multihop.py --dataset all --n 50

# Collect results
npx tsx ../../scripts/benchmark/collect-results.ts
```
