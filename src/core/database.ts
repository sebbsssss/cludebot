import Database from 'better-sqlite3';
import path from 'path';
import { createChildLogger } from './logger';

const log = createChildLogger('database');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'cluude.db');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    log.info({ path: dbPath }, 'Database opened');
  }
  return db;
}

export function initDatabase(): void {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS wallet_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      x_handle TEXT UNIQUE NOT NULL,
      x_user_id TEXT UNIQUE NOT NULL,
      wallet_address TEXT NOT NULL,
      verified_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS token_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      signature TEXT UNIQUE NOT NULL,
      event_type TEXT NOT NULL,
      wallet_address TEXT NOT NULL,
      amount REAL,
      sol_value REAL,
      timestamp DATETIME NOT NULL,
      metadata TEXT,
      processed BOOLEAN DEFAULT FALSE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS processed_mentions (
      tweet_id TEXT PRIMARY KEY,
      feature TEXT NOT NULL,
      response_tweet_id TEXT,
      processed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS opinion_commits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tweet_id TEXT NOT NULL,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      answer_hash TEXT NOT NULL,
      solana_signature TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS rate_limits (
      key TEXT PRIMARY KEY,
      count INTEGER DEFAULT 0,
      window_start DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS price_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      price_usd REAL NOT NULL,
      volume_24h REAL,
      market_cap REAL,
      recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_token_events_processed ON token_events(processed);
    CREATE INDEX IF NOT EXISTS idx_token_events_timestamp ON token_events(timestamp);
    CREATE INDEX IF NOT EXISTS idx_price_snapshots_recorded ON price_snapshots(recorded_at);
  `);

  log.info('Database schema initialized');
}

// Rate limiting helpers
export function checkRateLimit(key: string, maxCount: number, windowMinutes: number): boolean {
  const db = getDb();
  const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

  const row = db.prepare(
    'SELECT count, window_start FROM rate_limits WHERE key = ?'
  ).get(key) as { count: number; window_start: string } | undefined;

  if (!row || row.window_start < cutoff) {
    db.prepare(
      'INSERT OR REPLACE INTO rate_limits (key, count, window_start) VALUES (?, 1, ?)'
    ).run(key, new Date().toISOString());
    return true;
  }

  if (row.count >= maxCount) return false;

  db.prepare('UPDATE rate_limits SET count = count + 1 WHERE key = ?').run(key);
  return true;
}

export function isAlreadyProcessed(tweetId: string): boolean {
  const db = getDb();
  const row = db.prepare('SELECT 1 FROM processed_mentions WHERE tweet_id = ?').get(tweetId);
  return !!row;
}

export function markProcessed(tweetId: string, feature: string, responseTweetId?: string): void {
  const db = getDb();
  db.prepare(
    'INSERT OR IGNORE INTO processed_mentions (tweet_id, feature, response_tweet_id) VALUES (?, ?, ?)'
  ).run(tweetId, feature, responseTweetId || null);
}
