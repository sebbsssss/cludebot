import { Role } from '../role';
import { storeRoleMemory } from '../memory';

const DAY_MS = 24 * 60 * 60 * 1000;
const DRAFTER_INTERVAL_MS = parseInt(process.env.GROWTH_DRAFTER_INTERVAL_MS || String(DAY_MS), 10);

async function tick(): Promise<void> {
  await storeRoleMemory('drafter', {
    type: 'procedural',
    summary: 'Drafter placeholder — v0.2 will generate hero content + submission packets',
    content: [
      'Tick placeholder. When activated (v0.2):',
      '- Weekly hero content: one long-form post grounded in real commits + benchmark numbers',
      '- Daily supporting: X drafts, README patches, directory submission packets',
      '- All claims must link to specific commit / benchmark / memory id',
      '- Budget: opus only for hero, sonnet otherwise (enforced via guardBudget)',
    ].join('\n'),
    importance: 0.3,
    tags: ['drafter-placeholder'],
  });
}

const role = new (class extends Role {})({
  name: 'drafter',
  intervalMs: DRAFTER_INTERVAL_MS,
  tick,
});

export function start(): void { role.start(); }
export function stop(): void { role.stop(); }
