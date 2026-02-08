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
