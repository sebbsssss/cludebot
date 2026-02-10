// ============================================================
// Shared Constants
//
// All magic numbers, well-known addresses, and token lists
// live here. No hardcoded values scattered across features.
// ============================================================

/** Solana Memo Program (used for on-chain opinion commits) */
export const MEMO_PROGRAM_ID = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';

/** Max characters for a single tweet */
export const TWEET_MAX_LENGTH = 280;

/** Cluude-specific tweet target (leaves room for closers) */
export const TWEET_TARGET_LENGTH = 270;

/** Memo program payload limit (bytes) */
export const MEMO_MAX_LENGTH = 566;

/** Max characters for memory content field */
export const MEMORY_CONTENT_MAX = 5000;

/** Max characters for memory summary field */
export const MEMORY_SUMMARY_MAX = 500;

/** Memory decay rate per cycle (5% reduction) */
export const MEMORY_DECAY_RATE = 0.95;

/** Minimum decay factor before a memory is considered forgotten */
export const MEMORY_DECAY_FLOOR = 0.05;

/** Recency half-life in hours for memory scoring */
export const MEMORY_RECENCY_HALF_LIFE_HOURS = 24;

/** Price snapshot retention period (hours) */
export const PRICE_SNAPSHOT_RETENTION_HOURS = 48;

/** Whale sell flag cooldown (ms) */
export const WHALE_SELL_COOLDOWN_MS = 30 * 60 * 1000;

/** Major tokens — only post market updates about these */
export const MAJOR_TOKENS = new Set([
  'SOL', 'BTC', 'ETH', 'BONK', 'WIF', 'JTO', 'JUP', 'PYTH', 'RAY', 'RNDR', 'HNT',
]);

/** Well-known memecoins — included in market monitoring */
export const KNOWN_MEMECOINS = new Set([
  'BONK', 'WIF', 'POPCAT', 'MEW', 'BOME', 'WEN', 'MYRO', 'SAMO', 'SLERF',
  'PONKE', 'BOOK', 'MOODENG', 'PNUT', 'GOAT', 'ACT', 'AI16Z', 'FARTCOIN',
  'GRIFFAIN', 'PENGU', 'TRUMP',
]);

/** Stablecoins and wrapped SOL — excluded from market movers */
export const EXCLUDED_TOKENS = new Set(['SOL', 'USDC', 'USDT', 'PYUSD']);

/**
 * Check if a token symbol is noteworthy enough for market alerts.
 */
export function isNoteworthyToken(symbol: string): boolean {
  const upper = symbol.toUpperCase();
  return MAJOR_TOKENS.has(upper) || KNOWN_MEMECOINS.has(upper);
}
