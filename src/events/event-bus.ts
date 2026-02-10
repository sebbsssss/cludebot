import { EventEmitter } from 'events';
import { createChildLogger } from '../core/logger';
import type { Mood } from '../core/price-oracle';
import type { HeliusWebhookPayload } from '../types/api';

const log = createChildLogger('event-bus');

// ============================================================
// Event Bus
//
// Typed publish-subscribe system for decoupling features.
// Features subscribe to events they care about instead of
// being directly imported by the dispatcher or webhook handler.
//
// This eliminates tight coupling between:
//   - Webhook handler → exit-interview feature
//   - Webhook handler → price-oracle (whale sell flag)
//   - Dispatcher → individual feature handlers
// ============================================================

export interface BotEvents {
  /** Fired when a whale sell is detected via Helius webhook */
  'whale:sell': { wallet: string; solValue: number; signature: string };

  /** Fired when a holder fully exits (balance → 0) */
  'holder:exit': { wallet: string; tokenAmount: number; solValue: number };

  /** Fired when a new token event is stored in the database */
  'token:event': { signature: string; eventType: string; wallet: string; solValue: number };

  /** Fired when price oracle updates mood */
  'mood:changed': { previous: Mood; current: Mood };

  /** Fired when a webhook payload is received */
  'webhook:received': { payload: HeliusWebhookPayload[] };
}

type EventName = keyof BotEvents;
type EventHandler<T extends EventName> = (data: BotEvents[T]) => void | Promise<void>;

class TypedEventBus {
  private emitter = new EventEmitter();

  constructor() {
    // Increase listener limit — features subscribe to multiple events
    this.emitter.setMaxListeners(30);
  }

  on<T extends EventName>(event: T, handler: EventHandler<T>): void {
    this.emitter.on(event, (data: BotEvents[T]) => {
      Promise.resolve(handler(data)).catch(err => {
        log.error({ err, event }, 'Event handler error');
      });
    });
  }

  emit<T extends EventName>(event: T, data: BotEvents[T]): void {
    log.debug({ event }, 'Event emitted');
    this.emitter.emit(event, data);
  }

  removeAllListeners(): void {
    this.emitter.removeAllListeners();
  }
}

/** Singleton event bus instance */
export const eventBus = new TypedEventBus();
