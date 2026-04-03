// SDK exports — available when imported as a library: import { Cortex } from 'clude-bot'
export { Cortex } from '@clude/core/sdk';
export type {
  CortexConfig,
  DreamOptions,
  MemoryType,
  Memory,
  MemorySummary,
  StoreMemoryOptions,
  RecallOptions,
  MemoryStats,
  MemoryLinkType,
  MemoryConcept,
} from '@clude/core/sdk';

// Bot startup — only runs when executed directly, not when imported
if (require.main === module) {
  const { bootstrap } = require('./bootstrap');
  bootstrap().catch((err: any) => {
    const { createChildLogger } = require('@clude/core/core/logger');
    const log = createChildLogger('main');
    log.fatal({ err }, 'Failed to start. Even booting up is too much effort sometimes.');
    process.exit(1);
  });
}
