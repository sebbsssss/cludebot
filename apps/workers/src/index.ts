import { config } from '@clude/shared/config';
import { createChildLogger } from '@clude/shared/core/logger';

const log = createChildLogger('workers');

async function main(): Promise<void> {
  log.info('=== CLUDE WORKERS ===');
  log.info('Starting background workers...');

  // Initialize OpenRouter (required for inference in workers)
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

  // Initialize database
  const { initDatabase } = require('@clude/shared/core/database');
  await initDatabase();
  log.info('Database initialized');

  // Set owner wallet if configured
  if (config.owner.wallet) {
    const { _setOwnerWallet } = require('@clude/brain/memory');
    _setOwnerWallet(config.owner.wallet);
  }

  // Register event handlers
  const { registerEventHandlers } = require('@clude/brain/events/handlers');
  registerEventHandlers();

  // Start all workers
  const { startAllWorkers, stopAllWorkers } = require('@clude/brain/workers');
  await startAllWorkers();

  log.info('All workers running.');

  // Graceful shutdown
  const shutdown = () => {
    log.info('Shutting down workers...');
    stopAllWorkers();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(err => {
  log.fatal({ err }, 'Worker process failed to start');
  process.exit(1);
});
