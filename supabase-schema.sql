-- Run this in the Supabase SQL Editor to create all required tables

CREATE TABLE IF NOT EXISTS wallet_links (
  id BIGSERIAL PRIMARY KEY,
  x_handle TEXT UNIQUE NOT NULL,
  x_user_id TEXT UNIQUE NOT NULL,
  wallet_address TEXT NOT NULL,
  verified_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS token_events (
  id BIGSERIAL PRIMARY KEY,
  signature TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  amount DOUBLE PRECISION,
  sol_value DOUBLE PRECISION,
  timestamp TIMESTAMPTZ NOT NULL,
  metadata JSONB,
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS processed_mentions (
  tweet_id TEXT PRIMARY KEY,
  feature TEXT NOT NULL,
  response_tweet_id TEXT,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS opinion_commits (
  id BIGSERIAL PRIMARY KEY,
  tweet_id TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  answer_hash TEXT NOT NULL,
  solana_signature TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER DEFAULT 0,
  window_start TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS price_snapshots (
  id BIGSERIAL PRIMARY KEY,
  price_usd DOUBLE PRECISION NOT NULL,
  volume_24h DOUBLE PRECISION,
  market_cap DOUBLE PRECISION,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_token_events_processed ON token_events(processed);
CREATE INDEX IF NOT EXISTS idx_token_events_timestamp ON token_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_price_snapshots_recorded ON price_snapshots(recorded_at);

-- ============================================================
-- MEMORY SYSTEM: The Cortex
-- Episodic, Semantic, Procedural, and Self-Model memory
-- ============================================================

-- Enable trigram similarity for fuzzy text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS memories (
  id BIGSERIAL PRIMARY KEY,
  memory_type TEXT NOT NULL CHECK (memory_type IN ('episodic', 'semantic', 'procedural', 'self_model')),
  content TEXT NOT NULL,
  summary TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  emotional_valence REAL DEFAULT 0,       -- -1 (negative) to 1 (positive)
  importance REAL DEFAULT 0.5,            -- 0 to 1
  access_count INTEGER DEFAULT 0,
  source TEXT,                            -- trigger: mention, market, consolidation, reflection, emergence
  source_id TEXT,                         -- tweet ID, event ID, etc.
  related_user TEXT,                      -- X user ID if relevant
  related_wallet TEXT,                    -- wallet address if relevant
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_accessed TIMESTAMPTZ DEFAULT NOW(),
  decay_factor REAL DEFAULT 1.0,          -- decreases over time if not accessed
  evidence_ids BIGINT[] DEFAULT '{}'     -- IDs of memories that support this one (Park et al. 2023)
);

-- Dream logs: consolidation, reflection, emergence sessions
CREATE TABLE IF NOT EXISTS dream_logs (
  id BIGSERIAL PRIMARY KEY,
  session_type TEXT NOT NULL CHECK (session_type IN ('consolidation', 'reflection', 'emergence')),
  input_memory_ids BIGINT[] DEFAULT '{}',
  output TEXT NOT NULL,
  new_memories_created BIGINT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for memory retrieval
CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(memory_type);
CREATE INDEX IF NOT EXISTS idx_memories_tags ON memories USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance DESC);
CREATE INDEX IF NOT EXISTS idx_memories_user ON memories(related_user);
CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memories_decay ON memories(decay_factor);
CREATE INDEX IF NOT EXISTS idx_memories_summary_trgm ON memories USING GIN(summary gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_memories_evidence ON memories USING GIN(evidence_ids);
CREATE INDEX IF NOT EXISTS idx_dream_logs_type ON dream_logs(session_type);
CREATE INDEX IF NOT EXISTS idx_dream_logs_created ON dream_logs(created_at DESC);
