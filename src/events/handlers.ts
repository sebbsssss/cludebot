import { eventBus } from './event-bus';
import { flagWhaleSell } from '../core/price-oracle';
import { handleExitInterview } from '../features/exit-interview';
import { createChildLogger } from '../core/logger';

const log = createChildLogger('event-handlers');

// ============================================================
// Event Handlers
//
// Central place to wire up event subscriptions.
// Called once at startup from index.ts.
//
// This replaces direct feature imports in webhook handlers
// and creates clean decoupling between data ingestion and
// feature logic.
// ============================================================

export function registerEventHandlers(): void {
  // Whale sell → flag price oracle mood
  eventBus.on('whale:sell', ({ wallet, solValue }) => {
    log.info({ wallet, solValue }, 'Whale sell event received');
    flagWhaleSell();
  });

  // Holder full exit → trigger exit interview
  eventBus.on('holder:exit', ({ wallet, tokenAmount, solValue }) => {
    log.info({ wallet, tokenAmount }, 'Holder exit event received');
    handleExitInterview(wallet, tokenAmount, solValue);
  });

  log.debug('Event handlers registered');
}
