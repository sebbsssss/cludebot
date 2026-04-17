import { createChildLogger } from '@clude/shared/core/logger';
import * as analyst from './roles/analyst';
import * as ceo from './roles/ceo';
import * as researcher from './roles/researcher';
import * as drafter from './roles/drafter';
import * as publisher from './roles/publisher';

const log = createChildLogger('growth-swarm');

export function isEnabled(): boolean {
  return process.env.GROWTH_SWARM_ENABLED === 'true';
}

export function startSwarm(): void {
  log.info('Starting growth swarm');
  analyst.start();
  ceo.start();
  researcher.start();
  drafter.start();
  publisher.start();
}

export function stopSwarm(): void {
  log.info('Stopping growth swarm');
  analyst.stop();
  ceo.stop();
  researcher.stop();
  drafter.stop();
  publisher.stop();
}
