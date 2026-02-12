import { EventEmitter } from 'events';
import type { Mood } from '../core/price-oracle';

/**
 * Typed event bus — decouples webhook handlers from feature logic.
 *
 * Events flow: webhook → eventBus.emit() → registered handlers
 * This prevents direct cross-layer imports (e.g. base-handler importing exit-interview).
 */
export interface BotEvents {
  'whale:sell': { wallet: string; solValue: number; signature: string };
  'holder:exit': { wallet: string; tokenAmount: number; solValue: number };
  'token:event': { signature: string; eventType: string; wallet: string; solValue: number };
  'mood:changed': { previous: Mood; current: Mood };
  'memory:stored': { importance: number; memoryType: string };
}

class TypedEventBus {
  private emitter = new EventEmitter();

  on<K extends keyof BotEvents>(event: K, handler: (payload: BotEvents[K]) => void): void {
    this.emitter.on(event, handler);
  }

  emit<K extends keyof BotEvents>(event: K, payload: BotEvents[K]): void {
    this.emitter.emit(event, payload);
  }

  off<K extends keyof BotEvents>(event: K, handler: (payload: BotEvents[K]) => void): void {
    this.emitter.off(event, handler);
  }

  removeAllListeners(): void {
    this.emitter.removeAllListeners();
  }
}

export const eventBus = new TypedEventBus();
