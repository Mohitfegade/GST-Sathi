-- Migration 070: Sales & Returns tables
-- Tables: sales_entries, sales_invoices, return_periods, return_drafts

-- ============================================================================
-- 1. sales_entries
-- ============================================================================

create table public.sales_entries (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade, -- denormalised
  client_id uuid not null references public.clients(id) on delete cascade,
  entry_date date not null,
  cash_total numeric(14,2) not null default 0,
  upi_total numeric(14,2) not null default 0,
  taxable_sales numeric(14,2) not null default 0,
  exempt_sales numeric(14,2) not null default 0,
  source public.sales_source not null default 'manual',
  document_id uuid references public.documents(id) on delete set null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz
);

comment on table public.sales_entries is 'Daily or consolidated sales register entries (cash/UPI/taxable/exempt).';
comment on column public.sales_entries.firm_id is 'Denormalised firm_id reference for multi-tenant isolation.';

-- Indexes for sales_entries
create index idx_sales_entries_firm_id on public.sales_entries (firm_id);
create index idx_sales_entries_client_id on public.sales_entries (client_id);
create index idx_sales_entries_entry_date on public.sales_entries (entry_date);
create index idx_sales_entries_document_id on public.sales_entries (document_id);

-- Trigger for sales_entries
create trigger set_sales_entries_updated_at
  before update on public.sales_entries
  for each row
  execute function public.set_updated_at();

-- RLS for sales_entries
alter table public.sales_entries enable row level security;

create policy "sales_entries_select"
  on public.sales_entries
  for select
  using (
    public.is_firm_member(firm_id)
    or public.is_client_owner(client_id)
    or public.is_platform_admin()
  );

create policy "sales_entries_insert"
  on public.sales_entries
  for insert
  with check (
    public.is_firm_member(firm_id)
    or public.is_client_owner(client_id)
    or public.is_platform_admin()
  );

create policy "sales_entries_update"
  on public.sales_entries
  for update
  using (
    public.is_firm_member(firm_id)
    or public.is_client_owner(client_id)
    or public.is_platform_admin()
  )
  with check (
    public.is_firm_member(firm_id)
    or public.is_client_owner(client_id)
    or public.is_platform_admin()
  );

create policy "sales_entries_delete"
  on public.sales_entries
  for delete
  using (
    public.is_firm_admin(firm_id)
    or public.is_platform_admin()
  );

-- ============================================================================
-- 2. sales_invoices
-- ============================================================================

create table public.sales_invoices (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade, -- denormalised
  client_id uuid not null references public.clients(id) on delete cascade,
  invoice_no text not null,
  invoice_date date not null,
  buyer_gstin text check (buyer_gstin is null or (length(buyer_gstin) = 15 and buyer_gstin = upper(buyer_gstin))),
  place_of_supply text not null check (length(place_of_supply) = 2),
  taxable_value numeric(14,2) not null default 0,
  cgst numeric(14,2) not null default 0,
  sgst numeric(14,2) not null default 0,
  igst numeric(14,2) not null default 0,
  cess numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  doc_type public.sales_doc_type not null default 'tax_invoice',
  status public.inv_status not null default 'draft',
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz
);

comment on table public.sales_invoices is 'Outward sales invoices, bills of supply, debit/credit notes for GSTR-1.';
comment on column public.sales_invoices.firm_id is 'Denormalised firm_id reference for multi-tenant isolation.';

-- Indexes for sales_invoices
create index idx_sales_invoices_firm_id on public.sales_invoices (firm_id);
create index idx_sales_invoices_client_id on public.sales_invoices (client_id);
create index idx_sales_invoices_invoice_no on public.sales_invoices (invoice_no);
create index idx_sales_invoices_invoice_date on public.sales_invoices (invoice_date);

-- Trigger for sales_invoices
create trigger set_sales_invoices_updated_at
  before update on public.sales_invoices
  for each row
  execute function public.set_updated_at();

-- RLS for sales_invoices
alter table public.sales_invoices enable row level security;

create policy "sales_invoices_select"
  on public.sales_invoices
  for select
  using (
    public.is_firm_member(firm_id)
    or public.is_client_owner(client_id)
    or public.is_platform_admin()
  );

create policy "sales_invoices_insert"
  on public.sales_invoices
  for insert
  with check (
    public.is_firm_member(firm_id)
    or public.is_platform_admin()
  );

create policy "sales_invoices_update"
  on public.sales_invoices
  for update
  using (
    public.is_firm_member(firm_id)
    or public.is_platform_admin()
  )
  with check (
    public.is_firm_member(firm_id)
    or public.is_platform_admin()
  );

create policy "sales_invoices_delete"
  on public.sales_invoices
  for delete
  using (
    public.is_firm_admin(firm_id)
    or public.is_platform_admin()
  );

-- ============================================================================
-- 3. return_periods
-- ============================================================================

create table public.return_periods (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade, -- denormalised
  client_id uuid not null references public.clients(id) on delete cascade,
  return_type public.return_type not null,
  fp text not null check (length(fp) = 6 and fp ~ '^(0[1-9]|1[0-2])[0-9]{4}$'),
  due_date date not null,
  status public.return_status not null default 'not_started',
  filed_on timestamptz,
  ack_ref text,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz
);

comment on table public.return_periods is 'GST return filing tracking per client, return type, and filing period (MMYYYY).';
comment on column public.return_periods.firm_id is 'Denormalised firm_id reference for multi-tenant isolation.';
comment on column public.return_periods.fp is 'Filing period formatted as MMYYYY (e.g. 042026).';

-- Partial unique index for active return periods
create unique index return_periods_client_return_type_fp_idx
  on public.return_periods (client_id, return_type, fp)
  where deleted_at is null;

-- Indexes for return_periods
create index idx_return_periods_firm_id on public.return_periods (firm_id);
create index idx_return_periods_client_id on public.return_periods (client_id);
create index idx_return_periods_fp on public.return_periods (fp);
create index idx_return_periods_status on public.return_periods (status);

-- Trigger for return_periods
create trigger set_return_periods_updated_at
  before update on public.return_periods
  for each row
  execute function public.set_updated_at();

-- RLS for return_periods
alter table public.return_periods enable row level security;

create policy "return_periods_select"
  on public.return_periods
  for select
  using (
    public.is_firm_member(firm_id)
    or public.is_client_owner(client_id)
    or public.is_platform_admin()
  );

create policy "return_periods_insert"
  on public.return_periods
  for insert
  with check (
    public.is_firm_member(firm_id)
    or public.is_platform_admin()
  );

create policy "return_periods_update"
  on public.return_periods
  for update
  using (
    public.is_firm_member(firm_id)
    or public.is_platform_admin()
  )
  with check (
    public.is_firm_member(firm_id)
    or public.is_platform_admin()
  );

create policy "return_periods_delete"
  on public.return_periods
  for delete
  using (
    public.is_firm_admin(firm_id)
    or public.is_platform_admin()
  );

-- ============================================================================
-- 4. return_drafts
-- ============================================================================

create table public.return_drafts (
  id uuid primary key default gen_random_uuid(),
  return_period_id uuid not null references public.return_periods(id) on delete cascade,
  version integer not null default 1,
  payload jsonb not null default '{}'::jsonb,
  rule_snapshot_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz,
  constraint return_drafts_period_version_key unique (return_period_id, version)
);

comment on table public.return_drafts is 'Versioned JSON return draft payloads (GSTR-1, GSTR-3B, CMP-08) and CA approval state.';

-- Indexes for return_drafts
create index idx_return_drafts_return_period_id on public.return_drafts (return_period_id);

-- Trigger for return_drafts
create trigger set_return_drafts_updated_at
  before update on public.return_drafts
  for each row
  execute function public.set_updated_at();

-- RLS for return_drafts
alter table public.return_drafts enable row level security;

create policy "return_drafts_select"
  on public.return_drafts
  for select
  using (
    exists (
      select 1
      from public.return_periods rp
      where rp.id = return_drafts.return_period_id
        and (
          public.is_firm_member(rp.firm_id)
          or public.is_client_owner(rp.client_id)
          or public.is_platform_admin()
        )
    )
  );

create policy "return_drafts_insert"
  on public.return_drafts
  for insert
  with check (
    exists (
      select 1
      from public.return_periods rp
      where rp.id = return_drafts.return_period_id
        and (
          public.is_firm_member(rp.firm_id)
          or public.is_platform_admin()
        )
    )
  );

create policy "return_drafts_update"
  on public.return_drafts
  for update
  using (
    exists (
      select 1
      from public.return_periods rp
      where rp.id = return_drafts.return_period_id
        and (
          public.is_firm_member(rp.firm_id)
          or public.is_platform_admin()
        )
    )
  )
  with check (
    exists (
      select 1
      from public.return_periods rp
      where rp.id = return_drafts.return_period_id
        and (
          public.is_firm_member(rp.firm_id)
          or public.is_platform_admin()
        )
    )
  );

create policy "return_drafts_delete"
  on public.return_drafts
  for delete
  using (
    exists (
      select 1
      from public.return_periods rp
      where rp.id = return_drafts.return_period_id
        and (
          public.is_firm_admin(rp.firm_id)
          or public.is_platform_admin()
        )
    )
  );
