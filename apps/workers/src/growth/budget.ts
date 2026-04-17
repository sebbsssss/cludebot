import { createChildLogger } from '@clude/shared/core/logger';
import { getDb } from '@clude/shared/core/database';
import type { RoleName, SpendLogEntry } from './types';

const log = createChildLogger('growth-budget');

const DEFAULT_WEEKLY_USD = parseFloat(process.env.GROWTH_WEEKLY_USD_BUDGET || '50');

const PER_MILLION_USD: Record<string, { input: number; output: number }> = {
  'claude-opus-4-6': { input: 15, output: 75 },
  'claude-opus-4-7': { input: 15, output: 75 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-haiku-4-5': { input: 1, output: 5 },
};

export function estimateUsd(model: string, inputTokens: number, outputTokens: number): number {
  const rate = PER_MILLION_USD[model] || PER_MILLION_USD['claude-sonnet-4-6'];
  return (inputTokens * rate.input + outputTokens * rate.output) / 1_000_000;
}

function weekStartIso(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = now.getUTCDate() - day;
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), diff));
  return start.toISOString();
}

export async function recordSpend(entry: SpendLogEntry): Promise<void> {
  const db = getDb();
  const { error } = await db.from('growth_spend').insert({
    role: entry.role,
    model: entry.model,
    input_tokens: entry.input_tokens,
    output_tokens: entry.output_tokens,
    usd_estimate: entry.usd_estimate,
    ts: entry.ts,
  });
  if (error) {
    log.error({ err: error, role: entry.role }, 'Failed to record growth spend');
  }
}

export async function weeklySpendUsd(): Promise<number> {
  const db = getDb();
  const start = weekStartIso();
  const { data, error } = await db
    .from('growth_spend')
    .select('usd_estimate')
    .gte('ts', start);
  if (error) {
    log.error({ err: error }, 'Failed to read weekly spend');
    return 0;
  }
  return (data || []).reduce((s, r) => s + (r.usd_estimate || 0), 0);
}

export async function withinBudget(): Promise<boolean> {
  const ceiling = DEFAULT_WEEKLY_USD;
  const spent = await weeklySpendUsd();
  const ok = spent < ceiling;
  if (!ok) {
    log.warn({ spent, ceiling }, 'Growth budget exhausted for week');
  }
  return ok;
}

export async function guardBudget(role: RoleName): Promise<boolean> {
  const ok = await withinBudget();
  if (!ok) {
    log.warn({ role }, 'Role skipped — weekly budget exhausted');
  }
  return ok;
}
