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
export const MEMORY_MAX_CONTENT_LENGTH = 5000;
export const MEMORY_MAX_SUMMARY_LENGTH = 500;

// Memory retrieval — additive scoring (Park et al. 2023, Generative Agents)
export const RECENCY_DECAY_BASE = 0.995;               // Exponential: 0.995^hours since last access
export const RETRIEVAL_WEIGHT_RECENCY = 0.5;            // Paper: recency has lowest weight
export const RETRIEVAL_WEIGHT_RELEVANCE = 3.0;          // Paper: relevance dominates
export const RETRIEVAL_WEIGHT_IMPORTANCE = 2.0;         // Paper: importance is second

// Event-driven reflection triggers
export const REFLECTION_IMPORTANCE_THRESHOLD = 10;      // Cumulative importance to trigger reflection (0-1 scale)
export const REFLECTION_MIN_INTERVAL_MS = 30 * 60 * 1000; // Min 30 min between reflections

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
