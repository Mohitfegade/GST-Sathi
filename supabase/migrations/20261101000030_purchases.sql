-- Migration 030: Purchases tables
-- Suppliers, Invoices, Invoice Lines, Invoice Payments

-- ============================================================================
-- 1. Suppliers
-- ============================================================================

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  gstin text not null check (length(gstin) = 15 and gstin = upper(gstin)),
  name text not null,
  filing_status public.filing_status not null default 'unknown',
  last_checked_at timestamptz,
  notes text,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz
);

-- Partial unique index for active suppliers per client
create unique index suppliers_client_id_gstin_idx
  on public.suppliers (client_id, gstin)
  where deleted_at is null;

create index suppliers_firm_id_idx on public.suppliers (firm_id);
create index suppliers_client_id_idx on public.suppliers (client_id);

create trigger set_suppliers_updated_at
  before update on public.suppliers
  for each row
  execute function public.set_updated_at();

alter table public.suppliers enable row level security;

create policy "suppliers_select"
  on public.suppliers
  for select
  using (
    public.is_firm_member(firm_id)
    or public.is_client_owner(client_id)
    or public.is_platform_admin()
  );

create policy "suppliers_insert"
  on public.suppliers
  for insert
  with check (
    public.is_firm_member(firm_id)
    or public.is_platform_admin()
  );

create policy "suppliers_update"
  on public.suppliers
  for update
  using (
    public.is_firm_member(firm_id)
    or public.is_platform_admin()
  )
  with check (
    public.is_firm_member(firm_id)
    or public.is_platform_admin()
  );

create policy "suppliers_delete"
  on public.suppliers
  for delete
  using (
    public.is_firm_admin(firm_id)
    or public.is_platform_admin()
  );

-- ============================================================================
-- 2. Invoices (Purchase bills)
-- ============================================================================

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  document_id uuid references public.documents(id) on delete set null,
  invoice_no text not null,
  invoice_no_norm text not null,
  invoice_date date not null,
  place_of_supply text not null check (length(place_of_supply) = 2),
  taxable_value numeric(14,2) not null default 0,
  cgst numeric(14,2) not null default 0,
  sgst numeric(14,2) not null default 0,
  igst numeric(14,2) not null default 0,
  cess numeric(14,2) not null default 0,
  round_off numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  status public.inv_status not null default 'draft',
  source public.inv_source not null default 'extracted',
  itc_state public.itc_state not null default 'eligible',
  period_fp text not null check (length(period_fp) = 6 and period_fp ~ '^(0[1-9]|1[0-2])[0-9]{4}$'),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz
);

create index invoices_firm_id_idx on public.invoices (firm_id);
create index invoices_client_id_idx on public.invoices (client_id);
create index invoices_supplier_id_idx on public.invoices (supplier_id);
create index invoices_document_id_idx on public.invoices (document_id);
create index invoices_period_fp_idx on public.invoices (period_fp);
create index invoices_invoice_no_norm_idx on public.invoices (invoice_no_norm);
create index invoices_client_period_idx on public.invoices (client_id, period_fp);

create trigger set_invoices_updated_at
  before update on public.invoices
  for each row
  execute function public.set_updated_at();

alter table public.invoices enable row level security;

create policy "invoices_select"
  on public.invoices
  for select
  using (
    public.is_firm_member(firm_id)
    or public.is_client_owner(client_id)
    or public.is_platform_admin()
  );

create policy "invoices_insert"
  on public.invoices
  for insert
  with check (
    public.is_firm_member(firm_id)
    or public.is_platform_admin()
  );

create policy "invoices_update"
  on public.invoices
  for update
  using (
    public.is_firm_member(firm_id)
    or public.is_platform_admin()
  )
  with check (
    public.is_firm_member(firm_id)
    or public.is_platform_admin()
  );

create policy "invoices_delete"
  on public.invoices
  for delete
  using (
    public.is_firm_admin(firm_id)
    or public.is_platform_admin()
  );

-- ============================================================================
-- 3. Invoice Lines
-- ============================================================================

create table public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  line_no smallint not null,
  description text not null,
  hsn text,
  qty numeric(12,3) not null default 1,
  unit text not null default 'NOS',
  unit_price numeric(14,2) not null default 0,
  taxable_value numeric(14,2) not null default 0,
  tax_rate numeric(5,2) not null default 0,
  cgst numeric(14,2) not null default 0,
  sgst numeric(14,2) not null default 0,
  igst numeric(14,2) not null default 0,
  cess numeric(14,2) not null default 0,
  rate_rule_id uuid,
  rate_status public.rate_status not null default 'unknown',
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz,
  unique (invoice_id, line_no)
);

create index invoice_lines_invoice_id_idx on public.invoice_lines (invoice_id);

create trigger set_invoice_lines_updated_at
  before update on public.invoice_lines
  for each row
  execute function public.set_updated_at();

alter table public.invoice_lines enable row level security;

create policy "invoice_lines_select"
  on public.invoice_lines
  for select
  using (
    exists (
      select 1
      from public.invoices inv
      where inv.id = invoice_lines.invoice_id
        and (
          public.is_firm_member(inv.firm_id)
          or public.is_client_owner(inv.client_id)
          or public.is_platform_admin()
        )
    )
  );

create policy "invoice_lines_insert"
  on public.invoice_lines
  for insert
  with check (
    exists (
      select 1
      from public.invoices inv
      where inv.id = invoice_lines.invoice_id
        and (
          public.is_firm_member(inv.firm_id)
          or public.is_platform_admin()
        )
    )
  );

create policy "invoice_lines_update"
  on public.invoice_lines
  for update
  using (
    exists (
      select 1
      from public.invoices inv
      where inv.id = invoice_lines.invoice_id
        and (
          public.is_firm_member(inv.firm_id)
          or public.is_platform_admin()
        )
    )
  )
  with check (
    exists (
      select 1
      from public.invoices inv
      where inv.id = invoice_lines.invoice_id
        and (
          public.is_firm_member(inv.firm_id)
          or public.is_platform_admin()
        )
    )
  );

create policy "invoice_lines_delete"
  on public.invoice_lines
  for delete
  using (
    exists (
      select 1
      from public.invoices inv
      where inv.id = invoice_lines.invoice_id
        and (
          public.is_firm_admin(inv.firm_id)
          or public.is_platform_admin()
        )
    )
  );

-- ============================================================================
-- 4. Invoice Payments
-- ============================================================================

create table public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  paid_on date not null,
  amount numeric(14,2) not null check (amount > 0),
  mode public.pay_mode not null default 'bank',
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz
);

create index invoice_payments_invoice_id_idx on public.invoice_payments (invoice_id);

create trigger set_invoice_payments_updated_at
  before update on public.invoice_payments
  for each row
  execute function public.set_updated_at();

alter table public.invoice_payments enable row level security;

create policy "invoice_payments_select"
  on public.invoice_payments
  for select
  using (
    exists (
      select 1
      from public.invoices inv
      where inv.id = invoice_payments.invoice_id
        and (
          public.is_firm_member(inv.firm_id)
          or public.is_client_owner(inv.client_id)
          or public.is_platform_admin()
        )
    )
  );

create policy "invoice_payments_insert"
  on public.invoice_payments
  for insert
  with check (
    exists (
      select 1
      from public.invoices inv
      where inv.id = invoice_payments.invoice_id
        and (
          public.is_firm_member(inv.firm_id)
          or public.is_platform_admin()
        )
    )
  );

create policy "invoice_payments_update"
  on public.invoice_payments
  for update
  using (
    exists (
      select 1
      from public.invoices inv
      where inv.id = invoice_payments.invoice_id
        and (
          public.is_firm_member(inv.firm_id)
          or public.is_platform_admin()
        )
    )
  )
  with check (
    exists (
      select 1
      from public.invoices inv
      where inv.id = invoice_payments.invoice_id
        and (
          public.is_firm_member(inv.firm_id)
          or public.is_platform_admin()
        )
    )
  );

create policy "invoice_payments_delete"
  on public.invoice_payments
  for delete
  using (
    exists (
      select 1
      from public.invoices inv
      where inv.id = invoice_payments.invoice_id
        and (
          public.is_firm_admin(inv.firm_id)
          or public.is_platform_admin()
        )
    )
  );
