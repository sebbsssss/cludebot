import { Role } from '../role';
import { storeRoleMemory } from '../memory';
import { pendingCount } from '../gate';

const HOUR_MS = 60 * 60 * 1000;
const PUBLISHER_INTERVAL_MS = parseInt(process.env.GROWTH_PUBLISHER_INTERVAL_MS || String(HOUR_MS), 10);

async function tick(): Promise<void> {
  const pending = await pendingCount();

  await storeRoleMemory('publisher', {
    type: 'procedural',
    summary: `Publisher placeholder — ${pending} items pending in gate`,
    content: [
      'Tick placeholder. When activated (v0.2):',
      '- Owned channels auto: docs updates, X scheduled posts, npm tag releases, landing copy',
      '- 3rd party: items go through queueForApproval → founder approves in /growth/inbox',
      '- On approve: send under founder identity (via appropriate client)',
      '- Sub-module: @Cludebot live-reasoning mode (guardrailed) — strictly behind a feature flag',
    ].join('\n'),
    importance: 0.3,
    tags: ['publisher-placeholder'],
  });
}

const role = new (class extends Role {})({
  name: 'publisher',
  intervalMs: PUBLISHER_INTERVAL_MS,
  tick,
});

export function start(): void { role.start(); }
export function stop(): void { role.stop(); }
