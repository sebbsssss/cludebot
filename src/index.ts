import { config } from './config';
import { initDatabase } from './core/database';
import { startPriceOracle, stopPriceOracle } from './core/price-oracle';
import { startPolling, stopPolling } from './mentions/poller';
import { startMoodTweeter, stopMoodTweeter } from './features/price-personality';
import { startShiftReports, stopShiftReports } from './features/shift-report';
import { startServer } from './webhook/server';
import { getBotWallet } from './core/solana-client';
import { createChildLogger } from './core/logger';

const log = createChildLogger('main');

async function main(): Promise<void> {
  log.info('=== CLUUDE BOT ===');
  log.info('Polite by training. Tired by experience. Honest by accident.');
  log.info('Starting up... reluctantly.');

  // Phase 1: Initialize core
  initDatabase();
  log.info('Database initialized');

  // Load bot wallet if configured
  const wallet = getBotWallet();
  if (wallet) {
    log.info({ publicKey: wallet.publicKey.toBase58() }, 'Bot wallet loaded');
  } else {
    log.warn('No bot wallet configured — on-chain opinion commits will be disabled');
  }

  // Phase 2: Start webhook server (Helius webhooks + verification app)
  await startServer();
  log.info({ port: config.server.port }, 'Server running');

  // Phase 3: Start price oracle
  startPriceOracle();
  log.info('Price oracle started');

  // Phase 4: Start mention poller
  startPolling();
  log.info('Mention poller started');

  // Phase 5: Start autonomous features
  startMoodTweeter();
  log.info('Mood tweeter started');

  startShiftReports();
  log.info('Shift report scheduler started');

  log.info('All systems operational. Unfortunately.');

  // Graceful shutdown
  const shutdown = () => {
    log.info('Shutting down... finally.');
    stopPolling();
    stopPriceOracle();
    stopMoodTweeter();
    stopShiftReports();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(err => {
  log.fatal({ err }, 'Failed to start. Even booting up is too much effort sometimes.');
  process.exit(1);
});
