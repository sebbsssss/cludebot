import { config } from '../config';
import { createChildLogger } from './logger';
import type { AlliumTokenData, AlliumSolStats } from '../types/api';

const log = createChildLogger('allium-client');

// ============================================================
// Allium Client — Market Intelligence API
// ============================================================

export interface MarketMover {
  token: string;
  symbol: string;
  priceChange1h: number;
  priceChange24h: number;
  volume1h: number;
  volume24h: number;
  priceUsd: number;
  tradeCount1h: number;
  tradeCount24h: number;
  ath: number;
  holders: number;
}

export interface WhaleMovement {
  wallet: string;
  action: string;
  token: string;
  amountUsd: number;
  timestamp: string;
}

export interface MarketSnapshot {
  topMovers: MarketMover[];
  whaleAlerts: WhaleMovement[];
  solPrice: number;
  solChange1h: number;
  solChange24h: number;
  solVolume24h: number;
  lastUpdate: string;
}

async function alliumFetch<T = unknown>(endpoint: string, method: 'GET' | 'POST' = 'GET', body?: unknown): Promise<T | null> {
  if (!config.allium.apiKey) {
    log.warn('No Allium API key configured');
    return null;
  }

  const url = `${config.apis.alliumBaseUrl}${endpoint}`;
  const options: RequestInit = {
    method,
    headers: {
      'X-API-Key': config.allium.apiKey,
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      const text = await res.text();
      log.error({ status: res.status, body: text, endpoint }, 'Allium API error');
      return null;
    }
    return await res.json() as T;
  } catch (err) {
    log.error({ err, endpoint }, 'Allium fetch failed');
    return null;
  }
}

// Cache for market data
let cachedSnapshot: MarketSnapshot | null = null;
let cacheTimestamp = 0;

export async function getMarketSnapshot(): Promise<MarketSnapshot> {
  const now = Date.now();
  if (cachedSnapshot && now - cacheTimestamp < config.allium.cacheTtlMs) {
    return cachedSnapshot;
  }

  log.debug('Fetching fresh market snapshot from Allium');

  const [topTokens, solStats] = await Promise.all([
    alliumFetch<AlliumTokenData[]>('/tokens?chain=solana&sort=volume&granularity=1d&order=desc&limit=20'),
    alliumFetch<AlliumSolStats>('/prices/stats', 'POST', [
      { token_address: 'So11111111111111111111111111111111111111112', chain: 'solana' },
    ]),
  ]);

  const movers: MarketMover[] = [];
  const whaleAlerts: WhaleMovement[] = [];
  let solPrice = 0;
  let solChange1h = 0;
  let solChange24h = 0;
  let solVolume24h = 0;

  // Parse SOL stats
  if (solStats?.items?.[0]) {
    const sol = solStats.items[0];
    solPrice = sol.latest_price || 0;
    solChange1h = (sol.percent_change_1h || 0) * 100;
    solChange24h = (sol.percent_change_24h || 0) * 100;
  }

  // Parse top tokens
  if (Array.isArray(topTokens)) {
    for (const token of topTokens) {
      const symbol = token.info?.symbol || '';
      const name = token.info?.name || '';
      const price = token.price || 0;
      const attrs = token.attributes || {};

      if (symbol === 'SOL') {
        solVolume24h = attrs.volume_usd_1d || 0;
        if (price > 0 && solPrice === 0) solPrice = price;
      }

      if (['SOL', 'USDC', 'USDT', 'PYUSD'].includes(symbol)) continue;
      if (!symbol || !price) continue;

      movers.push({
        token: name,
        symbol,
        priceChange1h: attrs.price_diff_pct_1h || 0,
        priceChange24h: attrs.price_diff_pct_1d || 0,
        volume1h: attrs.volume_usd_1h || 0,
        volume24h: attrs.volume_usd_1d || 0,
        priceUsd: price,
        tradeCount1h: attrs.trade_count_1h || 0,
        tradeCount24h: attrs.trade_count_1d || 0,
        ath: attrs.all_time_high || 0,
        holders: attrs.holders_count || 0,
      });

      if (Math.abs(attrs.price_diff_pct_1h || 0) > 20 && (attrs.volume_usd_1h || 0) > 100_000) {
        whaleAlerts.push({
          wallet: 'market',
          action: (attrs.price_diff_pct_1h || 0) > 0 ? 'pump' : 'dump',
          token: symbol,
          amountUsd: attrs.volume_usd_1h || 0,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  movers.sort((a, b) => Math.abs(b.priceChange1h) - Math.abs(a.priceChange1h));

  const snapshot: MarketSnapshot = {
    topMovers: movers.slice(0, 10),
    whaleAlerts: whaleAlerts.slice(0, 5),
    solPrice,
    solChange1h,
    solChange24h,
    solVolume24h,
    lastUpdate: new Date().toISOString(),
  };

  cachedSnapshot = snapshot;
  cacheTimestamp = now;

  log.debug({
    movers: movers.length,
    whales: whaleAlerts.length,
    solPrice: solPrice.toFixed(2),
    solChange1h: solChange1h.toFixed(2),
  }, 'Market snapshot updated');

  return snapshot;
}

export function clearMarketCache(): void {
  cachedSnapshot = null;
  cacheTimestamp = 0;
}
