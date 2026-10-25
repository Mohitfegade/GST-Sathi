-- Migration 090: Audit & Alerts
-- Creates audit_events (append-only) and alerts tables with RLS and automated audit triggers

-- ============================================================================
-- 1. Table: public.audit_events
-- ============================================================================

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  entity text not null,
  entity_id uuid not null,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default clock_timestamp()
);

comment on table public.audit_events is 'Append-only audit log tracking changes to critical domain entities.';
comment on column public.audit_events.firm_id is 'Firm owning the entity change.';
comment on column public.audit_events.client_id is 'Optional client context if the entity relates to a client.';
comment on column public.audit_events.actor_id is 'Auth user who initiated the change (null for system/background actions).';
comment on column public.audit_events.action is 'Operation performed: INSERT, UPDATE, or DELETE.';
comment on column public.audit_events.entity is 'Target table name (e.g. clients, invoices, return_drafts, reconciliation_results).';
comment on column public.audit_events.entity_id is 'Primary key ID of the affected record.';
comment on column public.audit_events.before is 'Record state prior to update/delete (null on insert).';
comment on column public.audit_events.after is 'Record state after insert/update (null on delete).';

-- Indexes for audit_events
create index if not exists idx_audit_events_firm_id on public.audit_events (firm_id, created_at desc);
create index if not exists idx_audit_events_client_id on public.audit_events (client_id, created_at desc) where client_id is not null;
create index if not exists idx_audit_events_entity on public.audit_events (entity, entity_id);
create index if not exists idx_audit_events_actor_id on public.audit_events (actor_id);
create index if not exists idx_audit_events_created_at on public.audit_events (created_at desc);

-- ============================================================================
-- 2. Append-Only Enforcement on audit_events
-- ============================================================================

create or replace function public.prevent_audit_modification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'audit_events is append-only: updates and deletes are prohibited';
end;
$$;

comment on function public.prevent_audit_modification() is 'Guarantees append-only integrity on public.audit_events by rejecting UPDATE and DELETE operations.';

drop trigger if exists trg_audit_no_update_delete on public.audit_events;
create trigger trg_audit_no_update_delete
  before update or delete on public.audit_events
  for each row
  execute function public.prevent_audit_modification();

-- ============================================================================
-- 3. Row Level Security for public.audit_events
-- ============================================================================

alter table public.audit_events enable row level security;

-- Select: is_firm_admin(firm_id) or is_platform_admin()
create policy "audit_events_select"
  on public.audit_events
  for select
  using (
    public.is_firm_admin(firm_id)
    or public.is_platform_admin()
  );

-- Insert: allowed for system/service_role or authenticated actors or firm admins
create policy "audit_events_insert"
  on public.audit_events
  for insert
  with check (
    auth.role() = 'service_role'
    or (auth.uid() is not null and (actor_id is null or actor_id = auth.uid()))
    or public.is_firm_admin(firm_id)
    or public.is_platform_admin()
  );

-- Update / Delete: NO POLICY (strictly denied for everyone; also guarded by trigger)

-- ============================================================================
-- 4. Table: public.alerts
-- ============================================================================

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  kind public.alert_kind not null,
  severity public.severity not null default 'info',
  title text not null,
  body text not null,
  due_date date,
  status public.alert_status not null default 'open',
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz
);

comment on table public.alerts is 'System alerts and compliance notifications for firms and clients.';
comment on column public.alerts.firm_id is 'Firm to which this alert applies.';
comment on column public.alerts.client_id is 'Optional client to which this alert is scoped.';
comment on column public.alerts.kind is 'Category of alert: deadline, itc_at_risk, threshold, missing_docs, rule_change, late_fee.';
comment on column public.alerts.severity is 'Severity level: info, warn, urgent.';
comment on column public.alerts.status is 'Alert lifecycle status: open, dismissed, done.';

-- Indexes for alerts
create index if not exists idx_alerts_firm_id on public.alerts (firm_id);
create index if not exists idx_alerts_client_id on public.alerts (client_id);
create index if not exists idx_alerts_status on public.alerts (status);
create index if not exists idx_alerts_due_date on public.alerts (due_date);
create index if not exists idx_alerts_firm_status on public.alerts (firm_id, status) where deleted_at is null;
create index if not exists idx_alerts_client_status on public.alerts (client_id, status) where deleted_at is null;
create index if not exists idx_alerts_active_due on public.alerts (due_date) where status = 'open' and deleted_at is null;

-- Trigger: set_updated_at on alerts
drop trigger if exists set_alerts_updated_at on public.alerts;
create trigger set_alerts_updated_at
  before update on public.alerts
  for each row
  execute function public.set_updated_at();

-- ============================================================================
-- 5. Row Level Security for public.alerts
-- ============================================================================

alter table public.alerts enable row level security;

-- Select: is_firm_member(firm_id) or is_client_owner(client_id) or is_platform_admin()
create policy "alerts_select"
  on public.alerts
  for select
  using (
    public.is_firm_member(firm_id)
    or (client_id is not null and public.is_client_owner(client_id))
    or public.is_platform_admin()
  );

-- Insert: is_firm_member(firm_id) or is_platform_admin()
create policy "alerts_insert"
  on public.alerts
  for insert
  with check (
    public.is_firm_member(firm_id)
    or public.is_platform_admin()
  );

-- Update: is_firm_member(firm_id) or is_platform_admin()
create policy "alerts_update"
  on public.alerts
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
create policy "alerts_delete"
  on public.alerts
  for delete
  using (
    public.is_firm_admin(firm_id)
    or public.is_platform_admin()
  );

-- ============================================================================
-- 6. Generic Audit Trigger Function: public.audit_entity_change()
-- ============================================================================

create or replace function public.audit_entity_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rec jsonb;
  v_entity_id uuid;
  v_firm_id uuid;
  v_client_id uuid;
  v_actor_id uuid;
  v_before jsonb;
  v_after jsonb;
begin
  -- 1. Determine operation, entity_id, before/after snapshots
  if TG_OP = 'DELETE' then
    v_rec := to_jsonb(OLD);
    v_entity_id := (v_rec->>'id')::uuid;
    v_before := v_rec;
    v_after := null;
  elsif TG_OP = 'UPDATE' then
    v_rec := to_jsonb(NEW);
    v_entity_id := (v_rec->>'id')::uuid;
    v_before := to_jsonb(OLD);
    v_after := v_rec;
  elsif TG_OP = 'INSERT' then
    v_rec := to_jsonb(NEW);
    v_entity_id := (v_rec->>'id')::uuid;
    v_before := null;
    v_after := v_rec;
  else
    return null;
  end if;

  -- 2. Actor ID from Supabase auth session
  v_actor_id := auth.uid();
  if v_actor_id is not null then
    if not exists (select 1 from auth.users where id = v_actor_id) then
      v_actor_id := null;
    end if;
  end if;

  -- 3. Extract firm_id and client_id depending on target entity
  if TG_TABLE_NAME = 'clients' then
    v_firm_id := (v_rec->>'firm_id')::uuid;
    -- For the clients table itself, the entity ID is the client.
    -- On DELETE, client_id must be null to avoid violating the foreign key on public.audit_events.
    if TG_OP = 'DELETE' then
      v_client_id := null;
    else
      v_client_id := v_entity_id;
    end if;

  elsif TG_TABLE_NAME = 'invoices' then
    v_firm_id := (v_rec->>'firm_id')::uuid;
    v_client_id := (v_rec->>'client_id')::uuid;

  elsif TG_TABLE_NAME = 'return_drafts' then
    if v_rec ? 'firm_id' and (v_rec->>'firm_id') is not null then
      v_firm_id := (v_rec->>'firm_id')::uuid;
    end if;
    if v_rec ? 'client_id' and (v_rec->>'client_id') is not null then
      v_client_id := (v_rec->>'client_id')::uuid;
    end if;

    -- Lookup via parent return_periods if not present on draft record
    if (v_firm_id is null or v_client_id is null) and (v_rec ? 'return_period_id') and (v_rec->>'return_period_id') is not null then
      select rp.firm_id, rp.client_id
      into v_firm_id, v_client_id
      from public.return_periods rp
      where rp.id = (v_rec->>'return_period_id')::uuid;
    end if;

  elsif TG_TABLE_NAME = 'reconciliation_results' then
    if v_rec ? 'firm_id' and (v_rec->>'firm_id') is not null then
      v_firm_id := (v_rec->>'firm_id')::uuid;
    end if;
    if v_rec ? 'client_id' and (v_rec->>'client_id') is not null then
      v_client_id := (v_rec->>'client_id')::uuid;
    end if;

    -- Lookup via parent reconciliation_runs if not present on result record
    if (v_firm_id is null or v_client_id is null) and (v_rec ? 'run_id') and (v_rec->>'run_id') is not null then
      select rr.firm_id, rr.client_id
      into v_firm_id, v_client_id
      from public.reconciliation_runs rr
      where rr.id = (v_rec->>'run_id')::uuid;
    end if;

    -- Fallback lookup via invoice if still missing
    if (v_firm_id is null or v_client_id is null) and (v_rec ? 'invoice_id') and (v_rec->>'invoice_id') is not null then
      select inv.firm_id, inv.client_id
      into v_firm_id, v_client_id
      from public.invoices inv
      where inv.id = (v_rec->>'invoice_id')::uuid;
    end if;

  else
    -- Generic entity fallback
    if v_rec ? 'firm_id' and (v_rec->>'firm_id') is not null then
      v_firm_id := (v_rec->>'firm_id')::uuid;
    end if;
    if v_rec ? 'client_id' and (v_rec->>'client_id') is not null then
      v_client_id := (v_rec->>'client_id')::uuid;
    end if;
  end if;

  -- 4. Fallback: resolve firm_id via client_id if firm_id is still unassigned
  if v_firm_id is null and v_client_id is not null then
    select c.firm_id into v_firm_id
    from public.clients c
    where c.id = v_client_id;
  end if;

  -- 5. Foreign key validity protection for cascade deletions
  if v_client_id is not null then
    if not exists (select 1 from public.clients where id = v_client_id) then
      v_client_id := null;
    end if;
  end if;

  if v_firm_id is null or not exists (select 1 from public.firms where id = v_firm_id) then
    -- Cannot satisfy firm_id NOT NULL constraint (e.g. firm deletion in progress)
    return null;
  end if;

  -- 6. Insert audit event
  insert into public.audit_events (
    firm_id,
    client_id,
    actor_id,
    action,
    entity,
    entity_id,
    before,
    after,
    created_at
  ) values (
    v_firm_id,
    v_client_id,
    v_actor_id,
    TG_OP,
    TG_TABLE_NAME,
    v_entity_id,
    v_before,
    v_after,
    clock_timestamp()
  );

  return null;
end;
$$;

comment on function public.audit_entity_change() is 'Generic trigger function recording INSERT, UPDATE, and DELETE changes into public.audit_events.';

-- ============================================================================
-- 7. Attach Audit Triggers to Critical Entities
-- ============================================================================

-- public.clients
drop trigger if exists trg_audit_clients on public.clients;
create trigger trg_audit_clients
  after insert or update or delete on public.clients
  for each row
  execute function public.audit_entity_change();

-- public.invoices
drop trigger if exists trg_audit_invoices on public.invoices;
create trigger trg_audit_invoices
  after insert or update or delete on public.invoices
  for each row
  execute function public.audit_entity_change();

-- public.return_drafts
drop trigger if exists trg_audit_return_drafts on public.return_drafts;
create trigger trg_audit_return_drafts
  after insert or update or delete on public.return_drafts
  for each row
  execute function public.audit_entity_change();

-- public.reconciliation_results
drop trigger if exists trg_audit_reconciliation_results on public.reconciliation_results;
create trigger trg_audit_reconciliation_results
  after insert or update or delete on public.reconciliation_results
  for each row
  execute function public.audit_entity_change();
