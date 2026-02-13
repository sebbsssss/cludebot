import dotenv from 'dotenv';
dotenv.config();

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optional(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

export const config = {
  x: {
    apiKey: required('X_API_KEY'),
    apiSecret: required('X_API_SECRET'),
    accessToken: required('X_ACCESS_TOKEN'),
    accessSecret: required('X_ACCESS_SECRET'),
    botUserId: required('X_BOT_USER_ID'),
  },
  supabase: {
    url: required('SUPABASE_URL'),
    serviceKey: required('SUPABASE_SERVICE_KEY'),
  },
  anthropic: {
    apiKey: required('ANTHROPIC_API_KEY'),
    model: 'claude-opus-4-6' as const,
  },
  helius: {
    apiKey: optional('HELIUS_API_KEY', ''),
    webhookSecret: optional('HELIUS_WEBHOOK_SECRET', ''),
  },
  solana: {
    rpcUrl: optional('SOLANA_RPC_URL', 'https://api.mainnet-beta.solana.com'),
    botWalletPrivateKey: optional('BOT_WALLET_PRIVATE_KEY', ''),
    cludeTokenMint: optional('CLUUDE_TOKEN_MINT', ''),
  },
  base: {
    rpcUrl: optional('BASE_RPC_URL', 'https://mainnet.base.org'),
    testnetRpcUrl: optional('BASE_TESTNET_RPC_URL', 'https://sepolia.base.org'),
    botWalletPrivateKey: optional('BOT_WALLET_PRIVATE_KEY', ''),
    cludeTokenAddress: optional('CLUDE_TOKEN_ADDRESS', ''),
    basescanApiKey: optional('BASESCAN_API_KEY', ''),
  },
  server: {
    port: parseInt(optional('PORT', '3000'), 10),
    baseUrl: optional('BASE_URL', 'http://localhost:3000'),
  },
  intervals: {
    mentionPollMs: parseInt(optional('MENTION_POLL_INTERVAL_MS', '30000'), 10),
    pricePollMs: parseInt(optional('PRICE_POLL_INTERVAL_MS', '60000'), 10),
    shiftReportCron: optional('SHIFT_REPORT_CRON', '0 */12 * * *'),
    moodTweetMs: parseInt(optional('MOOD_TWEET_INTERVAL_MS', '7200000'), 10),
  },
  allium: {
    apiKey: optional('ALLIUM_API_KEY', ''),
    pollIntervalMs: parseInt(optional('MARKET_MONITOR_POLL_MS', '300000'), 10),
  },
  tiers: {
    whaleThreshold: parseInt(optional('TIER_WHALE_THRESHOLD', '1000000'), 10),
    smallThreshold: parseInt(optional('TIER_SMALL_THRESHOLD', '1'), 10),
  },
  agent: {
    rateLimitPerMin: parseInt(optional('AGENT_RATE_LIMIT', '10'), 10),
  },
  features: {
    showTxLinksInTweets: optional('SHOW_TX_LINKS_IN_TWEETS', 'false') === 'true',
  },
  activity: {
    minSolValue: parseFloat(optional('ACTIVITY_MIN_SOL', '5.0')),
    minEthValue: parseFloat(optional('ACTIVITY_MIN_ETH', '0.1')),
    whaleThreshold: parseFloat(optional('ACTIVITY_WHALE_SOL', '50.0')),
    maxEvents: parseInt(optional('ACTIVITY_MAX_EVENTS', '20'), 10),
  },
} as const;
