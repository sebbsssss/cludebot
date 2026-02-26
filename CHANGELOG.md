# Changelog

All notable changes to this project will be documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/).

## [2.4.0] — 2026-02-15

### Changed
- Slimmed npm package to pure memory SDK — bot internals no longer shipped
- Removed unused `@solana/spl-token` dependency
- Fixed all npm audit vulnerabilities

### Added
- Memory recall in exit interviews, opinion, and wallet-roast features
- Wallet-based memory recall
- Thread context support
- Security guardrails with keyword-based patterns
- Env-var-backed character configuration (persona content removed from source)
- Smart tweet truncation at word boundaries
- Atomic claim to prevent duplicate responses
- Timing logs for memory recall in response pipeline

### Fixed
- Duplicate memory storage
- Allium 403 spam and Helius serializer crash
- Guardrail false positive from word-count regex
- Missing column migrations in `initDatabase` startup
- Railway deploy: install all deps in production Docker stage

## [2.3.0] — 2026-01-28

### Added
- Molecular memory architecture documentation (`docs/MOLECULAR_MEMORY.md`)
- Hash-based memory IDs (Beads-inspired, collision-resistant)
- Memory compaction for old faded episodic memories
- Knowledge graph with typed bonds (causal, semantic, temporal, contradictory)
- Venice permissionless inference support (Llama, DeepSeek, Qwen)
- Configurable primary/fallback inference providers

### Fixed
- Thinking tokens for Claude models on Venice
- TypeScript errors in inference, venice-client, and dream-cycle modules

## [2.2.0] — 2026-01-15

### Added
- Hybrid memory retrieval (vector similarity + keyword + tag scoring)
- Granular vector decomposition with per-fragment embeddings
- Type-specific decay rates (episodic 0.93, semantic 0.98, procedural 0.97, self_model 0.99)
- Structured concept ontology with 12 controlled vocabulary labels
- Progressive disclosure: `recallSummaries()` and `hydrate()` API
- Pluggable embedding providers (Voyage AI, OpenAI) via `EMBEDDING_PROVIDER`
- Helius webhook signature verification (timing-safe)
- Rate limiting on webhook and API endpoints
- Solana address validation
