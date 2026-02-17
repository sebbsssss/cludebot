import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config';
import { createChildLogger } from './logger';

const log = createChildLogger('database');

let supabase: SupabaseClient;

export function getDb(): SupabaseClient {
  if (!supabase) {
    supabase = createClient(config.supabase.url, config.supabase.serviceKey);
    log.info('Supabase client initialized');
  }
  return supabase;
}

/** @internal SDK escape hatch — allows Cortex to inject a pre-configured client. */
export function _setDb(client: SupabaseClient): void {
  supabase = client;
}

export async function initDatabase(): Promise<void> {
  const db = getDb();

  // Create tables via SQL (using Supabase's rpc or direct REST)
  // We'll use the Supabase SQL editor approach — run migrations via rpc
  try {
    const { error } = await db.rpc('exec_sql', {
      query: `
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

        CREATE EXTENSION IF NOT EXISTS pg_trgm;

        CREATE TABLE IF NOT EXISTS memories (
          id BIGSERIAL PRIMARY KEY,
          memory_type TEXT NOT NULL CHECK (memory_type IN ('episodic', 'semantic', 'procedural', 'self_model')),
          content TEXT NOT NULL,
          summary TEXT NOT NULL,
          tags TEXT[] DEFAULT '{}',
          emotional_valence REAL DEFAULT 0,
          importance REAL DEFAULT 0.5,
          access_count INTEGER DEFAULT 0,
          source TEXT,
          source_id TEXT,
          related_user TEXT,
          related_wallet TEXT,
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          last_accessed TIMESTAMPTZ DEFAULT NOW(),
          decay_factor REAL DEFAULT 1.0
        );

        CREATE TABLE IF NOT EXISTS dream_logs (
          id BIGSERIAL PRIMARY KEY,
          session_type TEXT NOT NULL CHECK (session_type IN ('consolidation', 'reflection', 'emergence')),
          input_memory_ids BIGINT[] DEFAULT '{}',
          output TEXT NOT NULL,
          new_memories_created BIGINT[] DEFAULT '{}',
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(memory_type);
        CREATE INDEX IF NOT EXISTS idx_memories_tags ON memories USING GIN(tags);
        CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance DESC);
        CREATE INDEX IF NOT EXISTS idx_memories_user ON memories(related_user);
        CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_memories_decay ON memories(decay_factor);
        CREATE INDEX IF NOT EXISTS idx_dream_logs_type ON dream_logs(session_type);
        CREATE INDEX IF NOT EXISTS idx_dream_logs_created ON dream_logs(created_at DESC);

        CREATE TABLE IF NOT EXISTS agent_keys (
          id BIGSERIAL PRIMARY KEY,
          api_key TEXT UNIQUE NOT NULL,
          agent_id TEXT UNIQUE NOT NULL,
          agent_name TEXT NOT NULL,
          tier TEXT NOT NULL DEFAULT 'AGENT_UNKNOWN'
            CHECK (tier IN ('AGENT_VERIFIED', 'AGENT_UNKNOWN', 'AGENT_ALLY', 'AGENT_RIVAL')),
          total_interactions INTEGER DEFAULT 0,
          registered_at TIMESTAMPTZ DEFAULT NOW(),
          last_used TIMESTAMPTZ,
          is_active BOOLEAN DEFAULT TRUE,
          metadata JSONB DEFAULT '{}'
        );

        CREATE INDEX IF NOT EXISTS idx_agent_keys_api_key ON agent_keys(api_key);
        CREATE INDEX IF NOT EXISTS idx_token_events_activity ON token_events(sol_value DESC, timestamp DESC);

        -- Migration: evidence-linked reflections (Park et al. 2023)
        ALTER TABLE memories ADD COLUMN IF NOT EXISTS evidence_ids BIGINT[] DEFAULT '{}';
        CREATE INDEX IF NOT EXISTS idx_memories_evidence ON memories USING GIN(evidence_ids);

        -- Migration: on-chain memory commits
        ALTER TABLE memories ADD COLUMN IF NOT EXISTS solana_signature TEXT;
      `
    });

    if (error) {
      log.warn({ error: error.message }, 'Could not auto-create tables via rpc. Create tables via Supabase SQL editor.');
    }
  } catch {
    log.warn('rpc exec_sql not available. Create tables via Supabase SQL editor.');
  }

  log.info('Database initialized');
}

// Rate limiting helpers
export async function checkRateLimit(key: string, maxCount: number, windowMinutes: number): Promise<boolean> {
  const db = getDb();
  const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

  const { data: row } = await db
    .from('rate_limits')
    .select('count, window_start')
    .eq('key', key)
    .single();

  if (!row || row.window_start < cutoff) {
    await db
      .from('rate_limits')
      .upsert({ key, count: 1, window_start: new Date().toISOString() });
    return true;
  }

  if (row.count >= maxCount) return false;

  await db
    .from('rate_limits')
    .update({ count: row.count + 1 })
    .eq('key', key);
  return true;
}

export async function isAlreadyProcessed(tweetId: string): Promise<boolean> {
  const db = getDb();
  const { data } = await db
    .from('processed_mentions')
    .select('tweet_id')
    .eq('tweet_id', tweetId)
    .single();
  return !!data;
}

export async function markProcessed(tweetId: string, feature: string, responseTweetId?: string): Promise<void> {
  const db = getDb();
  await db
    .from('processed_mentions')
    .upsert({
      tweet_id: tweetId,
      feature,
      response_tweet_id: responseTweetId || null,
      processed_at: new Date().toISOString(),
    });
}
