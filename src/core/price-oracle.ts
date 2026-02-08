import { config } from '../config';
import { getDb } from './database';
import { createChildLogger } from './logger';

const log = createChildLogger('price-oracle');

export type Mood = 'PUMPING' | 'DUMPING' | 'SIDEWAYS' | 'NEW_ATH' | 'WHALE_SELL' | 'NEUTRAL';

interface PriceState {
  currentPrice: number;
  change1h: number;
  change24h: number;
  mood: Mood;
  lastUpdate: Date;
}

let currentState: PriceState = {
  currentPrice: 0,
  change1h: 0,
  change24h: 0,
  mood: 'NEUTRAL',
  lastUpdate: new Date(0),
};

let allTimeHigh = 0;
let recentWhaleSell = false;

export function getCurrentMood(): Mood {
  return currentState.mood;
}

export function getPriceState(): PriceState {
  return { ...currentState };
}

export function flagWhaleSell(): void {
  recentWhaleSell = true;
  // Reset after 30 minutes
  setTimeout(() => { recentWhaleSell = false; }, 30 * 60 * 1000);
}

async function fetchPrice(): Promise<{ price: number; volume24h: number } | null> {
  if (!config.solana.cluudeTokenMint) return null;

  try {
    const url = `https://api.jup.ag/price/v2?ids=${config.solana.cluudeTokenMint}`;
    const res = await fetch(url);
    const data = await res.json() as any;
    const tokenData = data.data?.[config.solana.cluudeTokenMint];
    if (!tokenData) return null;

    return {
      price: parseFloat(tokenData.price),
      volume24h: 0, // Jupiter price API v2 doesn't return volume directly
    };
  } catch (err) {
    log.error({ err }, 'Failed to fetch price');
    return null;
  }
}

function calculateMood(): Mood {
  if (recentWhaleSell) return 'WHALE_SELL';
  if (currentState.currentPrice > 0 && currentState.currentPrice >= allTimeHigh) return 'NEW_ATH';
  if (currentState.change1h >= 10) return 'PUMPING';
  if (currentState.change1h <= -10) return 'DUMPING';

  // Check sideways: get 6h of snapshots
  const db = getDb();
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const oldSnapshot = db.prepare(
    'SELECT price_usd FROM price_snapshots WHERE recorded_at <= ? ORDER BY recorded_at DESC LIMIT 1'
  ).get(sixHoursAgo) as { price_usd: number } | undefined;

  if (oldSnapshot && currentState.currentPrice > 0) {
    const change6h = ((currentState.currentPrice - oldSnapshot.price_usd) / oldSnapshot.price_usd) * 100;
    if (Math.abs(change6h) < 2) return 'SIDEWAYS';
  }

  return 'NEUTRAL';
}

export async function pollPrice(): Promise<void> {
  const priceData = await fetchPrice();
  if (!priceData) return;

  const db = getDb();

  // Store snapshot
  db.prepare(
    'INSERT INTO price_snapshots (price_usd, volume_24h) VALUES (?, ?)'
  ).run(priceData.price, priceData.volume24h);

  // Calculate 1h change
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const snapshot1h = db.prepare(
    'SELECT price_usd FROM price_snapshots WHERE recorded_at <= ? ORDER BY recorded_at DESC LIMIT 1'
  ).get(oneHourAgo) as { price_usd: number } | undefined;

  // Calculate 24h change
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const snapshot24h = db.prepare(
    'SELECT price_usd FROM price_snapshots WHERE recorded_at <= ? ORDER BY recorded_at DESC LIMIT 1'
  ).get(twentyFourHoursAgo) as { price_usd: number } | undefined;

  const change1h = snapshot1h
    ? ((priceData.price - snapshot1h.price_usd) / snapshot1h.price_usd) * 100
    : 0;
  const change24h = snapshot24h
    ? ((priceData.price - snapshot24h.price_usd) / snapshot24h.price_usd) * 100
    : 0;

  // Track ATH
  if (priceData.price > allTimeHigh) {
    allTimeHigh = priceData.price;
  }

  currentState = {
    currentPrice: priceData.price,
    change1h,
    change24h,
    mood: 'NEUTRAL',
    lastUpdate: new Date(),
  };

  currentState.mood = calculateMood();

  log.debug({
    price: priceData.price,
    change1h: change1h.toFixed(2),
    mood: currentState.mood,
  }, 'Price updated');

  // Clean up old snapshots (keep 48h)
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  db.prepare('DELETE FROM price_snapshots WHERE recorded_at < ?').run(cutoff);
}

let pollTimer: ReturnType<typeof setInterval> | null = null;

export function startPriceOracle(): void {
  log.info({ intervalMs: config.intervals.pricePollMs }, 'Starting price oracle');
  pollPrice(); // Initial poll
  pollTimer = setInterval(pollPrice, config.intervals.pricePollMs);
}

export function stopPriceOracle(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}
