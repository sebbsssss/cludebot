import { config } from '../config';
import { getDb } from './database';
import { createChildLogger } from './logger';
import { eventBus } from '../events/event-bus';
import { percentChange } from '../utils/format';
import { PRICE_SNAPSHOT_RETENTION_HOURS, WHALE_SELL_COOLDOWN_MS } from '../utils/constants';
import type { JupiterPriceResponse } from '../types/api';

const log = createChildLogger('price-oracle');

// ============================================================
// Price Oracle
//
// Class-based to encapsulate state. No more module-level
// mutable globals. Single instance exported for the app.
// ============================================================

export type Mood = 'PUMPING' | 'DUMPING' | 'SIDEWAYS' | 'NEW_ATH' | 'WHALE_SELL' | 'NEUTRAL';

export interface PriceState {
  currentPrice: number;
  change1h: number;
  change24h: number;
  mood: Mood;
  lastUpdate: Date;
}

class PriceOracle {
  private state: PriceState = {
    currentPrice: 0,
    change1h: 0,
    change24h: 0,
    mood: 'NEUTRAL',
    lastUpdate: new Date(0),
  };

  private allTimeHigh = 0;
  private recentWhaleSell = false;
  private whaleSellTimer: ReturnType<typeof setTimeout> | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  getCurrentMood(): Mood {
    return this.state.mood;
  }

  getPriceState(): PriceState {
    return { ...this.state };
  }

  flagWhaleSell(): void {
    this.recentWhaleSell = true;
    if (this.whaleSellTimer) clearTimeout(this.whaleSellTimer);
    this.whaleSellTimer = setTimeout(() => {
      this.recentWhaleSell = false;
    }, WHALE_SELL_COOLDOWN_MS);
  }

  async poll(): Promise<void> {
    const priceData = await this.fetchPrice();
    if (!priceData) return;

    const db = getDb();

    // Store snapshot
    await db
      .from('price_snapshots')
      .insert({ price_usd: priceData.price, volume_24h: priceData.volume24h });

    // Calculate changes
    const change1h = await this.calculateChange(db, 1, priceData.price);
    const change24h = await this.calculateChange(db, 24, priceData.price);

    if (priceData.price > this.allTimeHigh) {
      this.allTimeHigh = priceData.price;
    }

    const previousMood = this.state.mood;

    this.state = {
      currentPrice: priceData.price,
      change1h,
      change24h,
      mood: 'NEUTRAL',
      lastUpdate: new Date(),
    };

    this.state.mood = await this.calculateMood();

    // Emit mood change event if mood actually changed
    if (this.state.mood !== previousMood) {
      eventBus.emit('mood:changed', { previous: previousMood, current: this.state.mood });
    }

    log.debug({
      price: priceData.price,
      change1h: change1h.toFixed(2),
      mood: this.state.mood,
    }, 'Price updated');

    // Clean up old snapshots
    const cutoff = new Date(Date.now() - PRICE_SNAPSHOT_RETENTION_HOURS * 60 * 60 * 1000).toISOString();
    await db
      .from('price_snapshots')
      .delete()
      .lt('recorded_at', cutoff);
  }

  start(): void {
    log.info({ intervalMs: config.intervals.pricePollMs }, 'Starting price oracle');
    this.poll();
    this.pollTimer = setInterval(() => this.poll(), config.intervals.pricePollMs);
  }

  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.whaleSellTimer) {
      clearTimeout(this.whaleSellTimer);
      this.whaleSellTimer = null;
    }
  }

  // ---- Private ---- //

  private async fetchPrice(): Promise<{ price: number; volume24h: number } | null> {
    if (!config.solana.cluudeTokenMint) return null;

    try {
      const url = `${config.apis.jupiterPriceUrl}?ids=${config.solana.cluudeTokenMint}`;
      const res = await fetch(url);
      const data = await res.json() as JupiterPriceResponse;
      const tokenData = data.data?.[config.solana.cluudeTokenMint];
      if (!tokenData) return null;

      return { price: parseFloat(tokenData.price), volume24h: 0 };
    } catch (err) {
      log.error({ err }, 'Failed to fetch price');
      return null;
    }
  }

  private async calculateChange(db: ReturnType<typeof getDb>, hours: number, currentPrice: number): Promise<number> {
    const ago = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    const { data: snapshot } = await db
      .from('price_snapshots')
      .select('price_usd')
      .lte('recorded_at', ago)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .single();

    return snapshot ? percentChange(snapshot.price_usd, currentPrice) : 0;
  }

  private async calculateMood(): Promise<Mood> {
    if (this.recentWhaleSell) return 'WHALE_SELL';
    if (this.state.currentPrice > 0 && this.state.currentPrice >= this.allTimeHigh) return 'NEW_ATH';
    if (this.state.change1h >= 10) return 'PUMPING';
    if (this.state.change1h <= -10) return 'DUMPING';

    const db = getDb();
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const { data: oldSnapshot } = await db
      .from('price_snapshots')
      .select('price_usd')
      .lte('recorded_at', sixHoursAgo)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .single();

    if (oldSnapshot && this.state.currentPrice > 0) {
      const change6h = percentChange(oldSnapshot.price_usd, this.state.currentPrice);
      if (Math.abs(change6h) < 2) return 'SIDEWAYS';
    }

    return 'NEUTRAL';
  }
}

// ---- Singleton instance ---- //

const priceOracle = new PriceOracle();

// Public API (preserves existing import signatures)
export function getCurrentMood(): Mood { return priceOracle.getCurrentMood(); }
export function getPriceState(): PriceState { return priceOracle.getPriceState(); }
export function flagWhaleSell(): void { priceOracle.flagWhaleSell(); }
export async function pollPrice(): Promise<void> { return priceOracle.poll(); }
export function startPriceOracle(): void { priceOracle.start(); }
export function stopPriceOracle(): void { priceOracle.stop(); }
