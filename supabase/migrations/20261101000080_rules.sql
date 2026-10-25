-- Migration 080: Global rules tables
-- Tables: rule_snapshots, gst_rate_rules, rule_params
-- Global configuration and versioning tables (no firm_id)

-- 1. rule_snapshots
create table public.rule_snapshots (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  checksum text not null,
  created_at timestamptz not null default clock_timestamp()
);

-- 2. gst_rate_rules
create table public.gst_rate_rules (
  id uuid primary key default gen_random_uuid(),
  hsn_prefix text not null,
  description_pattern text,
  rate numeric(5,2) not null check (rate >= 0 and rate <= 100),
  effective_from date not null,
  effective_to date,
  source_ref text not null,
  verified_by_ca boolean not null default false,
  notes text,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz,
  constraint chk_gst_rate_rules_effective_range check (effective_to is null or effective_to >= effective_from)
);

-- 3. rule_params
create table public.rule_params (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  value jsonb not null,
  effective_from date not null,
  effective_to date,
  source_ref text not null,
  verified_by_ca boolean not null default false,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz,
  unique (key, effective_from),
  constraint chk_rule_params_effective_range check (effective_to is null or effective_to >= effective_from)
);

-- Indexes on hsn_prefix, key, effective_from, effective_to
create index idx_gst_rate_rules_hsn_prefix on public.gst_rate_rules (hsn_prefix);
create index idx_gst_rate_rules_effective_from on public.gst_rate_rules (effective_from);
create index idx_gst_rate_rules_effective_to on public.gst_rate_rules (effective_to);

create index idx_rule_params_key on public.rule_params (key);
create index idx_rule_params_effective_from on public.rule_params (effective_from);
create index idx_rule_params_effective_to on public.rule_params (effective_to);

create index idx_rule_snapshots_checksum on public.rule_snapshots (checksum);
create index idx_rule_snapshots_created_at on public.rule_snapshots (created_at desc);

-- Triggers: Attach set_updated_at() to gst_rate_rules and rule_params
create trigger set_gst_rate_rules_updated_at
  before update on public.gst_rate_rules
  for each row
  execute function public.set_updated_at();

create trigger set_rule_params_updated_at
  before update on public.rule_params
  for each row
  execute function public.set_updated_at();

-- Row Level Security (RLS) - deny by default
-- Any authenticated user can read (SELECT): auth.role() = 'authenticated'
-- Only platform admins can write (INSERT, UPDATE, DELETE): is_platform_admin()

-- RLS: rule_snapshots
alter table public.rule_snapshots enable row level security;

create policy "rule_snapshots_select"
  on public.rule_snapshots
  for select
  using (auth.role() = 'authenticated');

create policy "rule_snapshots_insert"
  on public.rule_snapshots
  for insert
  with check (public.is_platform_admin());

-- rule_snapshots is strictly append-only (no update, no delete policies)

-- RLS: gst_rate_rules
alter table public.gst_rate_rules enable row level security;

create policy "gst_rate_rules_select"
  on public.gst_rate_rules
  for select
  using (auth.role() = 'authenticated');

create policy "gst_rate_rules_insert"
  on public.gst_rate_rules
  for insert
  with check (public.is_platform_admin());

create policy "gst_rate_rules_update"
  on public.gst_rate_rules
  for update
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "gst_rate_rules_delete"
  on public.gst_rate_rules
  for delete
  using (public.is_platform_admin());

-- RLS: rule_params
alter table public.rule_params enable row level security;

create policy "rule_params_select"
  on public.rule_params
  for select
  using (auth.role() = 'authenticated');

create policy "rule_params_insert"
  on public.rule_params
  for insert
  with check (public.is_platform_admin());

create policy "rule_params_update"
  on public.rule_params
  for update
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "rule_params_delete"
  on public.rule_params
  for delete
  using (public.is_platform_admin());
