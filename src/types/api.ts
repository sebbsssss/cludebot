// ============================================================
// API Response Types
//
// Typed interfaces for external API responses. Eliminates
// `as any` throughout the codebase and gives autocomplete +
// compile-time safety for all external data.
// ============================================================

// ---- Jupiter Price API ---- //

export interface JupiterPriceResponse {
  data: Record<string, {
    id: string;
    type: string;
    price: string;
  } | undefined>;
  timeTaken: number;
}

// ---- Helius ---- //

export interface HeliusBalanceResponse {
  tokens: HeliusTokenBalance[];
  nativeBalance: number;
}

export interface HeliusTokenBalance {
  mint: string;
  amount: number;
  decimals: number;
  tokenAccount?: string;
}

export interface HeliusWebhookPayload {
  signature: string;
  timestamp: number;
  type: string;
  description: string;
  fee: number;
  nativeTransfers: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    amount: number;
  }>;
  tokenTransfers: Array<{
    mint: string;
    fromUserAccount: string;
    toUserAccount: string;
    tokenAmount: number;
    tokenStandard: string;
  }>;
}

// ---- Allium ---- //

export interface AlliumTokenData {
  info?: {
    symbol?: string;
    name?: string;
  };
  price?: number;
  attributes?: {
    price_diff_pct_1h?: number;
    price_diff_pct_1d?: number;
    volume_usd_1h?: number;
    volume_usd_1d?: number;
    trade_count_1h?: number;
    trade_count_1d?: number;
    all_time_high?: number;
    holders_count?: number;
  };
}

export interface AlliumSolStats {
  items?: Array<{
    latest_price?: number;
    percent_change_1h?: number;
    percent_change_24h?: number;
  }>;
}

// ---- Token Events (Database) ---- //

export interface TokenEventRow {
  id: number;
  signature: string;
  event_type: string;
  wallet_address: string;
  amount: number;
  sol_value: number;
  timestamp: string;
  metadata: Record<string, unknown> | string;
  processed: boolean;
  created_at: string;
}
