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

        -- Migration: concept ontology
        ALTER TABLE memories ADD COLUMN IF NOT EXISTS concepts TEXT[] DEFAULT '{}';
        CREATE INDEX IF NOT EXISTS idx_memories_concepts ON memories USING GIN(concepts);

        -- Migration: hash IDs and compaction tracking
        ALTER TABLE memories ADD COLUMN IF NOT EXISTS hash_id TEXT;
        ALTER TABLE memories ADD COLUMN IF NOT EXISTS compacted BOOLEAN DEFAULT FALSE;
        ALTER TABLE memories ADD COLUMN IF NOT EXISTS compacted_into TEXT;

        -- Backfill hash_ids for any existing memories that lack one
        UPDATE memories
        SET hash_id = 'clude-' || SUBSTRING(md5(id::text || created_at::text), 1, 8)
        WHERE hash_id IS NULL;

        CREATE INDEX IF NOT EXISTS idx_memories_compaction
        ON memories(memory_type, compacted, decay_factor, importance, created_at)
        WHERE memory_type = 'episodic' AND compacted = FALSE;

        -- Migration: expand dream_logs session types for compaction/decay
        ALTER TABLE dream_logs DROP CONSTRAINT IF EXISTS dream_logs_session_type_check;
        ALTER TABLE dream_logs ADD CONSTRAINT dream_logs_session_type_check
          CHECK (session_type IN ('consolidation', 'reflection', 'emergence', 'compaction', 'decay'));

        -- Campaign: tweet tracking
        CREATE TABLE IF NOT EXISTS campaign_tweets (
          id BIGSERIAL PRIMARY KEY,
          tweet_id TEXT UNIQUE NOT NULL,
          author_id TEXT NOT NULL,
          author_username TEXT,
          text TEXT NOT NULL,
          campaign_day INTEGER NOT NULL CHECK (campaign_day BETWEEN 1 AND 10),
          content_type TEXT DEFAULT 'general',
          likes INTEGER DEFAULT 0,
          retweets INTEGER DEFAULT 0,
          replies INTEGER DEFAULT 0,
          quotes INTEGER DEFAULT 0,
          engagement_score REAL DEFAULT 0,
          is_holder BOOLEAN DEFAULT FALSE,
          wallet_address TEXT,
          is_eligible BOOLEAN DEFAULT TRUE,
          tokens_awarded REAL DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          metrics_updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_campaign_tweets_day ON campaign_tweets(campaign_day);
        CREATE INDEX IF NOT EXISTS idx_campaign_tweets_score ON campaign_tweets(engagement_score DESC);

        -- Campaign: gacha spins
        CREATE TABLE IF NOT EXISTS campaign_gacha (
          id BIGSERIAL PRIMARY KEY,
          campaign_day INTEGER NOT NULL CHECK (campaign_day IN (2, 8)),
          wallet_address TEXT NOT NULL,
          x_handle TEXT,
          bet_amount REAL NOT NULL,
          multiplier REAL NOT NULL,
          win BOOLEAN NOT NULL,
          payout REAL DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_campaign_gacha_day ON campaign_gacha(campaign_day);

        -- Campaign: hackathon grants
        CREATE TABLE IF NOT EXISTS campaign_grants (
          id SERIAL PRIMARY KEY,
          grant_number INTEGER UNIQUE NOT NULL CHECK (grant_number BETWEEN 1 AND 3),
          reveal_day INTEGER NOT NULL,
          project_name TEXT DEFAULT '',
          project_url TEXT DEFAULT '',
          pfp_image_url TEXT DEFAULT '',
          description TEXT DEFAULT '',
          amount REAL DEFAULT 10000000,
          is_revealed BOOLEAN DEFAULT FALSE,
          revealed_at TIMESTAMPTZ
        );
        INSERT INTO campaign_grants (grant_number, reveal_day)
          VALUES (1, 4), (2, 6), (3, 9) ON CONFLICT DO NOTHING;

        -- Campaign: global state (single row)
        CREATE TABLE IF NOT EXISTS campaign_state (
          id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
          campaign_start TIMESTAMPTZ NOT NULL DEFAULT '2026-03-01T00:00:00Z',
          campaign_end TIMESTAMPTZ NOT NULL DEFAULT '2026-03-10T23:59:59Z',
          current_day INTEGER DEFAULT 0,
          total_tokens_distributed REAL DEFAULT 0,
          is_active BOOLEAN DEFAULT FALSE
        );
        INSERT INTO campaign_state (id, campaign_start, campaign_end)
          VALUES (1, '2026-03-01T00:00:00Z', '2026-03-10T23:59:59Z') ON CONFLICT DO NOTHING;
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

/**
 * Atomically claim a tweet for processing. Returns true if we got the lock,
 * false if another process already claimed it.
 * 
 * This prevents race conditions where two processes see isAlreadyProcessed=false
 * before either has a chance to mark it.
 */
export async function claimForProcessing(tweetId: string): Promise<boolean> {
  const db = getDb();
  
  // Insert with onConflict=ignore — only succeeds if no row exists
  const { error } = await db
    .from('processed_mentions')
    .insert({
      tweet_id: tweetId,
      feature: 'processing',
      response_tweet_id: null,
      processed_at: new Date().toISOString(),
    });
  
  // If error is unique violation (code 23505), another process claimed it
  if (error) {
    // Any error means we didn't get the lock (already exists or DB issue)
    return false;
  }
  
  return true;
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
