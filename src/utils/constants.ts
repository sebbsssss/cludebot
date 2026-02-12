/**
 * Centralized constants — magic numbers, well-known addresses, and configuration defaults.
 */

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

// Base chain
export const BASE_CHAIN_ID = 8453;
export const BASESCAN_TX_BASE_URL = 'https://basescan.org/tx';
export const BASESCAN_API_BASE_URL = 'https://api.basescan.org/api';
export const DEXSCREENER_PRICE_URL = 'https://api.dexscreener.com/latest/dex/tokens';
export const ALLIUM_BASE_URL = 'https://api.allium.so/api/v1/developer';

// WETH on Base (canonical)
export const BASE_WETH_ADDRESS = '0x4200000000000000000000000000000000000006';

// Minimal ERC-20 ABI for balance queries
export const ERC20_BALANCE_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
];

// Memo max length for on-chain calldata
export const MEMO_MAX_LENGTH = 566;

// Token lists for market monitoring (Base ecosystem)
export const MAJOR_TOKENS = new Set([
  'ETH', 'BTC', 'USDC', 'AERO', 'cbBTC', 'VIRTUAL', 'MORPHO', 'RSR',
]);

export const KNOWN_MEMECOINS = new Set([
  'BRETT', 'DEGEN', 'TOSHI', 'HIGHER', 'BASED', 'MOCHI', 'NORMIE',
  'KEYCAT', 'DOGINME', 'BENJI', 'SKI',
]);

export function isNoteworthyToken(symbol: string): boolean {
  const upper = symbol.toUpperCase();
  return MAJOR_TOKENS.has(upper) || KNOWN_MEMECOINS.has(upper);
}
