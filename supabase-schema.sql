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
