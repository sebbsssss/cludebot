import { config } from '@clude/shared/config';
import { getDb } from '@clude/shared/core/database';
import { sendChannelMessage } from '@clude/shared/core/telegram-client';
import { createChildLogger } from '@clude/shared/core/logger';
import { Role } from '../role';
import { storeRoleMemory } from '../memory';
import { weeklySpendUsd } from '../budget';
import { BENCHMARK_SOURCES, type KPISnapshot } from '../types';

const log = createChildLogger('growth-analyst');

const DAY_MS = 24 * 60 * 60 * 1000;
const ANALYST_INTERVAL_MS = parseInt(process.env.GROWTH_ANALYST_INTERVAL_MS || String(6 * 60 * 60 * 1000), 10);

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}

interface RawMemoryRow {
  owner_wallet: string | null;
  source: string | null;
  created_at: string;
}

async function fetchWindowMemories(sinceIso: string, excludeOwners: Set<string>): Promise<RawMemoryRow[]> {
  const db = getDb();
  const rows: RawMemoryRow[] = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await db
      .from('memories')
      .select('owner_wallet, source, created_at')
      .gte('created_at', sinceIso)
      .range(from, from + pageSize - 1);
    if (error) {
      log.error({ err: error }, 'Failed to read memories window');
      break;
    }
    if (!data || data.length === 0) break;
    for (const r of data as RawMemoryRow[]) {
      if (!r.owner_wallet) continue;
      if (excludeOwners.has(r.owner_wallet)) continue;
      if (r.source && BENCHMARK_SOURCES.has(r.source)) continue;
      if (r.source && r.source.startsWith('mcp:growth-')) continue;
      rows.push(r);
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

export async function computeSnapshot(): Promise<KPISnapshot> {
  const windowEnd = new Date();
  const windowStart = new Date(windowEnd.getTime() - 7 * DAY_MS);
  const priorStart = new Date(windowEnd.getTime() - 14 * DAY_MS);

  const excludeOwners = new Set<string>(
    [config.owner.wallet].filter((w): w is string => Boolean(w))
  );

  const windowRows = await fetchWindowMemories(windowStart.toISOString(), excludeOwners);
  const priorRows = await fetchWindowMemories(priorStart.toISOString(), excludeOwners);

  const currentWallets = new Set<string>();
  const priorOnlyWallets = new Set<string>();
  for (const r of windowRows) {
    if (r.owner_wallet) currentWallets.add(r.owner_wallet);
  }
  for (const r of priorRows) {
    const wallet = r.owner_wallet;
    if (!wallet) continue;
    const ts = new Date(r.created_at).getTime();
    if (ts < windowStart.getTime()) priorOnlyWallets.add(wallet);
  }

  const returning = [...currentWallets].filter(w => priorOnlyWallets.has(w)).length;

  const notes: string[] = [];
  notes.push('attribution: v0 — no per-channel UTMs yet. Counts are owner_wallet proxies for SDK installs.');
  notes.push(`excluded owners: ${excludeOwners.size}`);
  notes.push(`benchmark sources excluded: ${[...BENCHMARK_SOURCES].join(', ')}`);

  const snapshot: KPISnapshot = {
    window_start: windowStart.toISOString(),
    window_end: windowEnd.toISOString(),
    sdk_installs_total: windowRows.length,
    sdk_installs_unique_wallets: currentWallets.size,
    recall_calls: 0,
    store_calls: windowRows.length,
    returning_7d: returning,
    per_channel: {},
    attribution_confidence: 'low',
    notes,
  };

  return snapshot;
}

async function persistSnapshot(snapshot: KPISnapshot): Promise<void> {
  const db = getDb();
  const { error } = await db.from('growth_kpi_snapshots').insert({
    window_start: snapshot.window_start,
    window_end: snapshot.window_end,
    sdk_installs_total: snapshot.sdk_installs_total,
    sdk_installs_unique_wallets: snapshot.sdk_installs_unique_wallets,
    recall_calls: snapshot.recall_calls,
    store_calls: snapshot.store_calls,
    returning_7d: snapshot.returning_7d,
    per_channel: snapshot.per_channel,
    attribution_confidence: snapshot.attribution_confidence,
    notes: snapshot.notes,
  });
  if (error) {
    log.error({ err: error }, 'Failed to persist KPI snapshot');
  }
}

async function postWeeklyReport(snapshot: KPISnapshot, weeklyUsd: number): Promise<void> {
  if (!config.telegram.botToken || !config.telegram.channelId) return;
  const msg = [
    'Clude growth — 7-day honest report',
    '',
    `Unique wallets (installs proxy): ${snapshot.sdk_installs_unique_wallets}`,
    `Store calls: ${snapshot.store_calls}`,
    `Returning wallets (week-over-week): ${snapshot.returning_7d}`,
    `Attribution confidence: ${snapshot.attribution_confidence}`,
    '',
    `Swarm spend this week: $${weeklyUsd.toFixed(2)}`,
    '',
    `Notes:`,
    ...snapshot.notes.map(n => `• ${n}`),
  ].join('\n');
  await sendChannelMessage(msg).catch(err => log.error({ err }, 'Failed to send report'));
}

let lastReportTs = 0;
const REPORT_INTERVAL_MS = 7 * DAY_MS;

async function tick(): Promise<void> {
  log.info('Analyst tick');
  const snapshot = await computeSnapshot();
  await persistSnapshot(snapshot);

  await storeRoleMemory('analyst', {
    type: 'episodic',
    summary: `Growth snapshot: ${snapshot.sdk_installs_unique_wallets} unique wallets, ${snapshot.returning_7d} returning, ${snapshot.store_calls} store calls (7d)`,
    content: JSON.stringify(snapshot, null, 2),
    importance: 0.6,
    tags: ['kpi-snapshot'],
  });

  const now = Date.now();
  if (now - lastReportTs >= REPORT_INTERVAL_MS) {
    const weeklyUsd = await weeklySpendUsd();
    await postWeeklyReport(snapshot, weeklyUsd);
    lastReportTs = now;
  }
}

const role = new (class extends Role {})({
  name: 'analyst',
  intervalMs: ANALYST_INTERVAL_MS,
  tick,
});

export function start(): void { role.start(); }
export function stop(): void { role.stop(); }
