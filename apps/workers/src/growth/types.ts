export type RoleName = 'ceo' | 'researcher' | 'drafter' | 'publisher' | 'analyst';

export const MEMORY_SOURCE_PREFIX = 'mcp:growth-';

export function memorySource(role: RoleName): string {
  return `${MEMORY_SOURCE_PREFIX}${role}`;
}

export interface GateAction {
  id?: string;
  role: RoleName;
  kind: 'third_party_submission' | 'kol_outreach' | 'external_post';
  channel: string;
  target: string;
  subject: string;
  body: string;
  suggested_identity: 'founder' | 'cludebot';
  rationale: string;
}

export interface KPISnapshot {
  window_start: string;
  window_end: string;
  sdk_installs_total: number;
  sdk_installs_unique_wallets: number;
  recall_calls: number;
  store_calls: number;
  returning_7d: number;
  per_channel: Record<string, { installs: number; returning: number }>;
  attribution_confidence: 'low' | 'medium' | 'high';
  notes: string[];
}

export interface SpendLogEntry {
  role: RoleName;
  model: string;
  input_tokens: number;
  output_tokens: number;
  usd_estimate: number;
  ts: string;
}

export const BENCHMARK_SOURCES = new Set<string>([
  'locomo-benchmark',
  'longmemeval-benchmark',
]);
