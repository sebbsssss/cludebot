import { config } from '../config';
import { createChildLogger } from './logger';
import { ALLIUM_BASE_URL } from '../utils/constants';
import type { AlliumTokenData, AlliumNativeStats } from '../types/api';

const log = createChildLogger('allium-client');

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
  ethPrice: number;
  ethChange1h: number;
  ethChange24h: number;
  ethVolume24h: number;
  lastUpdate: string;
}

async function alliumFetch<T>(endpoint: string, method: 'GET' | 'POST' = 'GET', body?: unknown): Promise<T | null> {
  if (!config.allium.apiKey) {
    log.warn('No Allium API key configured');
    return null;
  }

  const url = `${ALLIUM_BASE_URL}${endpoint}`;
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

// Cache for market data to avoid hammering the API
let cachedSnapshot: MarketSnapshot | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000; // 1 minute

export async function getMarketSnapshot(): Promise<MarketSnapshot> {
  const now = Date.now();
  if (cachedSnapshot && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedSnapshot;
  }

  log.debug('Fetching fresh market snapshot from Allium');

  // Fetch top Base tokens by 24h volume and ETH price stats in parallel
  const [topTokens, ethStats] = await Promise.all([
    alliumFetch<AlliumTokenData[]>('/tokens?chain=base&sort=volume&granularity=1d&order=desc&limit=20'),
    alliumFetch<AlliumNativeStats>('/prices/stats', 'POST', [
      { token_address: '0x4200000000000000000000000000000000000006', chain: 'base' },
    ]),
  ]);

  const movers: MarketMover[] = [];
  const whaleAlerts: WhaleMovement[] = [];
  let ethPrice = 0;
  let ethChange1h = 0;
  let ethChange24h = 0;
  let ethVolume24h = 0;

  // Parse ETH stats
  if (ethStats?.items?.[0]) {
    const eth = ethStats.items[0];
    ethPrice = eth.latest_price || 0;
    ethChange1h = (eth.percent_change_1h || 0) * 100; // API returns decimal, convert to %
    ethChange24h = (eth.percent_change_24h || 0) * 100;
  }

  // Parse top tokens
  if (Array.isArray(topTokens)) {
    for (const token of topTokens) {
      const symbol = token.info?.symbol || '';
      const name = token.info?.name || '';
      const price = token.price || 0;
      const attrs = token.attributes || {};

      // Extract ETH volume
      if (symbol === 'ETH' || symbol === 'WETH') {
        ethVolume24h = attrs.volume_usd_1d || 0;
        if (price > 0 && ethPrice === 0) ethPrice = price;
      }

      // Skip stablecoins and ETH itself for movers
      if (['ETH', 'WETH', 'USDC', 'USDT', 'USDbC'].includes(symbol)) continue;
      if (!symbol || !price) continue;

      const change1h = attrs.price_diff_pct_1h || 0;
      const change24h = attrs.price_diff_pct_1d || 0;
      const volume1h = attrs.volume_usd_1h || 0;
      const volume24h = attrs.volume_usd_1d || 0;

      movers.push({
        token: name,
        symbol,
        priceChange1h: change1h,
        priceChange24h: change24h,
        volume1h,
        volume24h,
        priceUsd: price,
        tradeCount1h: attrs.trade_count_1h || 0,
        tradeCount24h: attrs.trade_count_1d || 0,
        ath: attrs.all_time_high || 0,
        holders: attrs.holders_count || 0,
      });

      // Flag extreme movers as whale-like activity
      if (Math.abs(change1h) > 20 && volume1h > 100_000) {
        whaleAlerts.push({
          wallet: 'market',
          action: change1h > 0 ? 'pump' : 'dump',
          token: symbol,
          amountUsd: volume1h,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  // Sort movers by absolute 1h price change (most volatile first)
  movers.sort((a, b) => Math.abs(b.priceChange1h) - Math.abs(a.priceChange1h));

  const snapshot: MarketSnapshot = {
    topMovers: movers.slice(0, 10),
    whaleAlerts: whaleAlerts.slice(0, 5),
    ethPrice,
    ethChange1h,
    ethChange24h,
    ethVolume24h,
    lastUpdate: new Date().toISOString(),
  };

  cachedSnapshot = snapshot;
  cacheTimestamp = now;

  log.debug({
    movers: movers.length,
    whales: whaleAlerts.length,
    ethPrice: ethPrice.toFixed(2),
    ethChange1h: ethChange1h.toFixed(2),
  }, 'Market snapshot updated');

  return snapshot;
}

export function clearMarketCache(): void {
  cachedSnapshot = null;
  cacheTimestamp = 0;
}
