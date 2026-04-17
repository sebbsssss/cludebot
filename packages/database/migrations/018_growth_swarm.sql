-- Growth Swarm tables
-- Created for the autonomous growth team that dogfoods Clude memory.
-- Design doc: ~/.gstack/projects/sebbsssss-cludebot/sebastien-*-design-*.md

create table if not exists growth_gate_inbox (
  id bigserial primary key,
  role text not null,
  kind text not null,
  channel text not null,
  target text not null,
  subject text not null,
  body text not null,
  suggested_identity text not null,
  rationale text not null,
  status text not null default 'pending',
  approved_body text,
  approver_wallet text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists idx_growth_gate_inbox_status on growth_gate_inbox (status, created_at desc);

create table if not exists growth_kpi_snapshots (
  id bigserial primary key,
  window_start timestamptz not null,
  window_end timestamptz not null,
  sdk_installs_total int not null default 0,
  sdk_installs_unique_wallets int not null default 0,
  recall_calls int not null default 0,
  store_calls int not null default 0,
  returning_7d int not null default 0,
  per_channel jsonb not null default '{}'::jsonb,
  attribution_confidence text not null default 'low',
  notes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_kpi_window on growth_kpi_snapshots (window_end desc);

create table if not exists growth_spend (
  id bigserial primary key,
  role text not null,
  model text not null,
  input_tokens int not null,
  output_tokens int not null,
  usd_estimate numeric(10, 4) not null,
  ts timestamptz not null default now()
);

create index if not exists idx_growth_spend_ts on growth_spend (ts desc);
create index if not exists idx_growth_spend_role_ts on growth_spend (role, ts desc);

create table if not exists growth_channels (
  id bigserial primary key,
  name text not null unique,
  kind text not null,
  url text,
  submission_format text,
  curation_notes text,
  contact text,
  last_submitted_at timestamptz,
  status text not null default 'discovered',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_channels_status on growth_channels (status);
create index if not exists idx_growth_channels_kind on growth_channels (kind);
