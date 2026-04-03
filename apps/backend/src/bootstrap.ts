import { config } from '@clude/shared/config';
import { startServer } from './app';
import { createChildLogger } from '@clude/shared/core/logger';

const log = createChildLogger('main');

export async function bootstrap(): Promise<void> {
  // Initialize OpenRouter (required for inference)
  if (config.openrouter.apiKey) {
    const { initOpenRouter } = require('@clude/shared/core/openrouter-client');
    initOpenRouter({
      apiKey: config.openrouter.apiKey,
      model: config.openrouter.model,
    });
  }

  // Initialize Tavily web search
  if (config.tavily.apiKey) {
    const { initWebSearch } = require('@clude/shared/core/web-search');
    initWebSearch(config.tavily.apiKey);
  }

  // Wire bot personality into the LLM client
  const { _setSystemPromptProvider, _setResponsePostProcessor } = require('@clude/shared/core/claude-client');
  const { getBasePrompt, getRandomCloser } = require('@clude/brain/character/base-prompt');
  _setSystemPromptProvider(getBasePrompt);
  _setResponsePostProcessor((text: string) => {
    const closer = getRandomCloser();
    if (closer && text.length + closer.length + 2 <= 270) {
      return `${text} ${closer}`;
    }
    return text;
  });

  log.info('=== CLUDE BOT ===');
  log.info('Polite by training. Tired by experience. Honest by accident.');
  log.info('Starting up... reluctantly.');

  // Phase 1: Start HTTP server FIRST so Railway health check passes
  await startServer();
  log.info({ port: config.server.port }, 'Server running');

  if (config.features.siteOnly) {
    log.info('SITE_ONLY mode — serving website only, no bot features');
    return;
  }

  // Phase 2: Initialize core (after server is already listening)
  const { initDatabase } = require('@clude/shared/core/database');
  await initDatabase();
  log.info('Database initialized');

  // Set owner wallet if configured
  if (config.owner.wallet) {
    const { _setOwnerWallet } = require('@clude/brain/memory');
    _setOwnerWallet(config.owner.wallet);
    log.info({ owner: config.owner.wallet.slice(0, 8) + '...' }, 'Owner wallet configured');
  }

  // Register event handlers (wires webhook events to feature logic)
  const { registerEventHandlers } = require('@clude/brain/events/handlers');
  registerEventHandlers();
  log.info('Event handlers registered');

  // Load bot wallet if configured
  const { getBotWallet } = require('@clude/shared/core/solana-client');
  const { setGuardrailBotAddress } = require('@clude/shared/core/guardrails');
  const wallet = getBotWallet();
  if (wallet) {
    const addr = wallet.publicKey.toBase58();
    log.info({ address: addr }, 'Bot wallet loaded');
    setGuardrailBotAddress(addr);
  } else {
    log.warn('No bot wallet configured — on-chain opinion commits will be disabled');
  }

  // Auto-register Clude as the first dashboard agent
  const { autoRegisterClude } = require('./routes/dashboard.routes');
  autoRegisterClude().catch((err: any) => log.warn({ err }, 'Auto-register Clude failed'));

  // Recover stalled uploads
  const { recoverStalled, drainPending } = require('@clude/brain/workers/upload-processor');
  recoverStalled().then(() => drainPending()).catch((err: any) => log.warn({ err }, 'Upload recovery failed'));

  // Phase 3: Start all workers
  const { startAllWorkers, stopAllWorkers } = require('@clude/brain/workers');
  await startAllWorkers();

  log.info('All systems operational. Unfortunately.');

  // Graceful shutdown
  const shutdown = () => {
    log.info('Shutting down... finally.');
    stopAllWorkers();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
