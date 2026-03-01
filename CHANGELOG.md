# Changelog

All notable changes to this project will be documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/).

## [2.5.1] — 2026-03-01

### Fixed
- npm onboarding: add bin entry point and postinstall banner

## [2.5.0] — 2026-02-28

### Added
- Entity co-occurrence expansion in memory recall pipeline
- Contradiction resolution phase in dream cycle (finds unresolved `contradicts` links, resolves via Claude, stores semantic resolution with `resolves` links)
- Entity-aware recall with bond-typed graph traversal and importance re-scoring
- `resolves` memory link type for contradiction resolution outcomes
- `get_unresolved_contradictions` and `get_entity_cooccurrence` Supabase RPC functions
- Entity knowledge graph: person, project, concept, token, wallet, location, event
- Deep Venice integration: cognitive model router, embeddings, stats API, web search
- Content filter on demo store endpoint (blocks hate speech and spam)
- Security: block CA spoofing attacks and URL prompt injection
- Context awareness to prevent confusion about other projects
- 10 Days campaign page, API routes, and tweet tracker

### Changed
- Upgraded cognitive router to Claude Opus/Sonnet via Venice
- Optimized cognitive model routing for cost/quality balance
- Improved memory retrieval accuracy: word boundaries, stopwords, rebalanced weights
- Routed X replies through Venice AI

### Fixed
- Backtest issues: await decay update, add resolves bond weight, deterministic tiebreak
- Memory corruption: exclude demo from recall, block cop-out consolidation, skip empty tweets
- Replace generic guardrail fallback with contextual responses
- Block Clude from engaging specific problematic threads

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
