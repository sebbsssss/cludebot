import { Role } from '../role';
import { storeRoleMemory, recallRoleMemories } from '../memory';
import { weeklySpendUsd } from '../budget';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const CEO_INTERVAL_MS = parseInt(process.env.GROWTH_CEO_INTERVAL_MS || String(WEEK_MS), 10);

async function tick(): Promise<void> {
  const spend = await weeklySpendUsd();
  const priorKpi = await recallRoleMemories('ceo', 'weekly growth kpi snapshot', {
    includeOtherRoles: true,
    limit: 5,
  });

  // v0 stub: record intent. Planning LLM call deferred to v0.2 so budget ceilings
  // and role prompt contracts can be reviewed (see design doc Reviewer Concerns).
  await storeRoleMemory('ceo', {
    type: 'procedural',
    summary: `CEO weekly plan placeholder — spend this week $${spend.toFixed(2)}, prior KPIs reviewed: ${priorKpi.length}`,
    content: [
      'CEO-agent tick placeholder.',
      'When activated (v0.2): read last Analyst snapshot, set 1-3 weekly goals,',
      'assign tasks to Researcher/Drafter/Publisher, surface anything needing founder gate.',
      'Goals get stored as semantic memories with tag growth-goal and referenced by other roles.',
    ].join('\n'),
    importance: 0.4,
    tags: ['ceo-plan-placeholder'],
  });
}

const role = new (class extends Role {})({
  name: 'ceo',
  intervalMs: CEO_INTERVAL_MS,
  tick,
});

export function start(): void { role.start(); }
export function stop(): void { role.stop(); }
