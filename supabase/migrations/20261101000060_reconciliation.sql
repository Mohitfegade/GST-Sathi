-- Migration 060: Reconciliation Tables and Policies
-- Creates reconciliation_runs and reconciliation_results tables, indexes, triggers, and RLS policies

-- =============================================================================
-- Table: public.reconciliation_runs
-- =============================================================================
create table if not exists public.reconciliation_runs (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  period_fp text not null check (length(period_fp) = 6 and period_fp ~ '^(0[1-9]|1[0-2])[0-9]{4}$'),
  import_id uuid references public.gstr2b_imports(id) on delete set null,
  status text not null default 'started',
  started_at timestamptz not null default clock_timestamp(),
  finished_at timestamptz,
  summary jsonb,
  rule_snapshot_id uuid,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz
);

comment on table public.reconciliation_runs is 'Reconciliation run sessions comparing purchase books with GSTR-2B.';
comment on column public.reconciliation_runs.firm_id is 'Denormalised firm_id reference for multi-tenant isolation.';
comment on column public.reconciliation_runs.period_fp is 'Financial period in MMYYYY format.';
comment on column public.reconciliation_runs.summary is 'Reconciliation run aggregate metrics and counters in JSONB.';

-- Indexes for public.reconciliation_runs
create index if not exists idx_reconciliation_runs_firm_id on public.reconciliation_runs (firm_id);
create index if not exists idx_reconciliation_runs_client_id on public.reconciliation_runs (client_id);
create index if not exists idx_reconciliation_runs_period_fp on public.reconciliation_runs (period_fp);
create index if not exists idx_reconciliation_runs_client_period on public.reconciliation_runs (client_id, period_fp);
create index if not exists idx_reconciliation_runs_status on public.reconciliation_runs (status);
create index if not exists idx_reconciliation_runs_import_id on public.reconciliation_runs (import_id);

-- Trigger: set_updated_at on public.reconciliation_runs
create trigger trg_reconciliation_runs_set_updated_at
  before update on public.reconciliation_runs
  for each row
  execute function public.set_updated_at();

-- =============================================================================
-- Table: public.reconciliation_results
-- =============================================================================
create table if not exists public.reconciliation_results (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.reconciliation_runs(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete cascade,
  gstr2b_record_id uuid references public.gstr2b_records(id) on delete cascade,
  status public.recon_status not null,
  match_pass smallint not null default 1,
  diff_taxable numeric(14,2) not null default 0,
  diff_tax numeric(14,2) not null default 0,
  itc_at_risk numeric(14,2) not null default 0,
  user_decision public.user_decision not null default 'none',
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz
);

comment on table public.reconciliation_results is 'Item-level reconciliation results between purchase invoices and GSTR-2B records.';
comment on column public.reconciliation_results.match_pass is 'Matching pass number (1=exact, 2=fuzzy, 3=period shift, etc.).';
comment on column public.reconciliation_results.diff_taxable is 'Difference in taxable value between books and GSTR-2B.';
comment on column public.reconciliation_results.diff_tax is 'Difference in total tax value between books and GSTR-2B.';
comment on column public.reconciliation_results.itc_at_risk is 'Estimated ITC at risk due to mismatches or vendor defaults.';
comment on column public.reconciliation_results.user_decision is 'Manual accountant decision override on reconciliation status.';

-- Indexes for public.reconciliation_results
create index if not exists idx_reconciliation_results_run_id on public.reconciliation_results (run_id);
create index if not exists idx_reconciliation_results_invoice_id on public.reconciliation_results (invoice_id);
create index if not exists idx_reconciliation_results_gstr2b_record_id on public.reconciliation_results (gstr2b_record_id);
create index if not exists idx_reconciliation_results_status on public.reconciliation_results (status);
create index if not exists idx_reconciliation_results_run_status on public.reconciliation_results (run_id, status);
create index if not exists idx_reconciliation_results_user_decision on public.reconciliation_results (user_decision);

-- Trigger: set_updated_at on public.reconciliation_results
create trigger trg_reconciliation_results_set_updated_at
  before update on public.reconciliation_results
  for each row
  execute function public.set_updated_at();

-- =============================================================================
-- Row Level Security: Deny by default, explicit policies
-- =============================================================================
alter table public.reconciliation_runs enable row level security;
alter table public.reconciliation_results enable row level security;

-- -----------------------------------------------------------------------------
-- Policies for public.reconciliation_runs
-- -----------------------------------------------------------------------------

-- Select: is_firm_member(firm_id) or is_client_owner(client_id) or is_platform_admin()
create policy "reconciliation_runs_select"
  on public.reconciliation_runs
  for select
  using (
    public.is_firm_member(firm_id)
    or public.is_client_owner(client_id)
    or public.is_platform_admin()
  );

-- Insert: is_firm_member(firm_id) or is_platform_admin()
create policy "reconciliation_runs_insert"
  on public.reconciliation_runs
  for insert
  with check (
    public.is_firm_member(firm_id)
    or public.is_platform_admin()
  );

-- Update: is_firm_member(firm_id) or is_platform_admin()
create policy "reconciliation_runs_update"
  on public.reconciliation_runs
  for update
  using (
    public.is_firm_member(firm_id)
    or public.is_platform_admin()
  )
  with check (
    public.is_firm_member(firm_id)
    or public.is_platform_admin()
  );

-- Delete: is_firm_admin(firm_id) or is_platform_admin()
create policy "reconciliation_runs_delete"
  on public.reconciliation_runs
  for delete
  using (
    public.is_firm_admin(firm_id)
    or public.is_platform_admin()
  );

-- -----------------------------------------------------------------------------
-- Policies for public.reconciliation_results
-- -----------------------------------------------------------------------------

-- Select: exists matching reconciliation_runs where is_firm_member, is_client_owner, or is_platform_admin
create policy "reconciliation_results_select"
  on public.reconciliation_results
  for select
  using (
    exists (
      select 1
      from public.reconciliation_runs rr
      where rr.id = run_id
        and (
          public.is_firm_member(rr.firm_id)
          or public.is_client_owner(rr.client_id)
          or public.is_platform_admin()
        )
    )
  );

-- Insert: exists matching reconciliation_runs where is_firm_member or is_platform_admin
create policy "reconciliation_results_insert"
  on public.reconciliation_results
  for insert
  with check (
    exists (
      select 1
      from public.reconciliation_runs rr
      where rr.id = run_id
        and (
          public.is_firm_member(rr.firm_id)
          or public.is_platform_admin()
        )
    )
  );

-- Update: exists matching reconciliation_runs where is_firm_member or is_platform_admin
create policy "reconciliation_results_update"
  on public.reconciliation_results
  for update
  using (
    exists (
      select 1
      from public.reconciliation_runs rr
      where rr.id = run_id
        and (
          public.is_firm_member(rr.firm_id)
          or public.is_platform_admin()
        )
    )
  )
  with check (
    exists (
      select 1
      from public.reconciliation_runs rr
      where rr.id = run_id
        and (
          public.is_firm_member(rr.firm_id)
          or public.is_platform_admin()
        )
    )
  );

-- Delete: exists matching reconciliation_runs where is_firm_admin or is_platform_admin
create policy "reconciliation_results_delete"
  on public.reconciliation_results
  for delete
  using (
    exists (
      select 1
      from public.reconciliation_runs rr
      where rr.id = run_id
        and (
          public.is_firm_admin(rr.firm_id)
          or public.is_platform_admin()
        )
    )
  );
