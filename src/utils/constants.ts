/**
 * Centralized constants — magic numbers, well-known addresses, and configuration defaults.
 */

export const MEMO_PROGRAM_ID = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';
export const MEMO_MAX_LENGTH = 566;
export const TWEET_MAX_LENGTH = 280;
export const TWEET_SAFE_LENGTH = 270;

// Memory system
export const MEMORY_DECAY_RATE = 0.95;
export const MEMORY_MIN_DECAY = 0.05;
export const MEMORY_RECENCY_HALF_LIFE_HOURS = 24;
export const MEMORY_MAX_CONTENT_LENGTH = 5000;
export const MEMORY_MAX_SUMMARY_LENGTH = 500;

// Price oracle
export const PRICE_SNAPSHOT_RETENTION_HOURS = 48;
export const WHALE_SELL_COOLDOWN_MS = 30 * 60 * 1000;
export const PUMP_DUMP_THRESHOLD_PERCENT = 10;
export const SIDEWAYS_THRESHOLD_PERCENT = 2;

// API URLs (defaults, overridable via config)
export const JUPITER_PRICE_URL = 'https://api.jup.ag/price/v2';
export const HELIUS_RPC_BASE_URL = 'https://mainnet.helius-rpc.com';
export const HELIUS_BALANCES_BASE_URL = 'https://api.helius.xyz/v0/addresses';
export const ALLIUM_BASE_URL = 'https://api.allium.so/api/v1/developer';
export const SOLSCAN_TX_BASE_URL = 'https://solscan.io/tx';

// Token lists for market monitoring
export const MAJOR_TOKENS = new Set([
  'SOL', 'BTC', 'ETH', 'BONK', 'WIF', 'JTO', 'JUP', 'PYTH', 'RAY', 'RNDR', 'HNT',
]);

export const KNOWN_MEMECOINS = new Set([
  'BONK', 'WIF', 'POPCAT', 'MEW', 'BOME', 'WEN', 'MYRO', 'SAMO', 'SLERF', 'PONKE',
  'BOOK', 'MOODENG', 'PNUT', 'GOAT', 'ACT', 'AI16Z', 'FARTCOIN', 'GRIFFAIN', 'PENGU', 'TRUMP',
]);

export function isNoteworthyToken(symbol: string): boolean {
  const upper = symbol.toUpperCase();
  return MAJOR_TOKENS.has(upper) || KNOWN_MEMECOINS.has(upper);
}
