-- Migration 050: GSTR-2B Tables and Policies
-- Creates gstr2b_imports and gstr2b_records tables, indexes, triggers, and RLS policies

-- =============================================================================
-- Table: public.gstr2b_imports
-- =============================================================================
create table if not exists public.gstr2b_imports (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  return_period_fp text not null check (length(return_period_fp) = 6 and return_period_fp ~ '^(0[1-9]|1[0-2])[0-9]{4}$'),
  generated_on timestamptz not null,
  is_recompute boolean not null default false,
  imported_by uuid references auth.users(id) on delete set null,
  record_count integer not null default 0 check (record_count >= 0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz,
  constraint fk_gstr2b_imports_client_firm foreign key (client_id, firm_id) references public.clients(id, firm_id) on delete cascade
);

comment on table public.gstr2b_imports is 'Imported GSTR-2B statement batches per client and return period.';
comment on column public.gstr2b_imports.firm_id is 'Denormalised firm_id reference for multi-tenant isolation.';
comment on column public.gstr2b_imports.return_period_fp is 'Return period in MMYYYY format (e.g. 042026).';
comment on column public.gstr2b_imports.is_recompute is 'True if recomputed after IMS changes.';

-- Indexes for public.gstr2b_imports
create index if not exists idx_gstr2b_imports_firm_id on public.gstr2b_imports (firm_id);
create index if not exists idx_gstr2b_imports_client_id on public.gstr2b_imports (client_id);
create index if not exists idx_gstr2b_imports_return_period_fp on public.gstr2b_imports (return_period_fp);
create index if not exists idx_gstr2b_imports_client_period on public.gstr2b_imports (client_id, return_period_fp);
create index if not exists idx_gstr2b_imports_document_id on public.gstr2b_imports (document_id);
create index if not exists idx_gstr2b_imports_imported_by on public.gstr2b_imports (imported_by);

-- Trigger: set_updated_at on public.gstr2b_imports
create trigger trg_gstr2b_imports_set_updated_at
  before update on public.gstr2b_imports
  for each row
  execute function public.set_updated_at();

-- =============================================================================
-- Table: public.gstr2b_records
-- =============================================================================
create table if not exists public.gstr2b_records (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.gstr2b_imports(id) on delete cascade,
  section public.gstr2b_section not null default 'b2b',
  supplier_gstin text not null check (length(supplier_gstin) = 15 and supplier_gstin = upper(supplier_gstin)),
  supplier_name text,
  doc_no text not null,
  doc_no_norm text not null,
  doc_date date not null,
  doc_type text not null default 'INV',
  taxable_value numeric(14,2) not null default 0,
  cgst numeric(14,2) not null default 0,
  sgst numeric(14,2) not null default 0,
  igst numeric(14,2) not null default 0,
  cess numeric(14,2) not null default 0,
  itc_available boolean not null default true,
  itc_reason text,
  ims_action public.ims_action not null default 'none',
  ims_action_at timestamptz,
  ims_action_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz
);

comment on table public.gstr2b_records is 'Individual supplier invoice/note records parsed from GSTR-2B imports.';
comment on column public.gstr2b_records.doc_no_norm is 'Normalized invoice number for robust multi-pass reconciliation.';
comment on column public.gstr2b_records.ims_action is 'IMS action status (none, accepted, rejected, pending).';

-- Indexes for public.gstr2b_records
create index if not exists idx_gstr2b_records_import_id on public.gstr2b_records (import_id);
create index if not exists idx_gstr2b_records_section on public.gstr2b_records (section);
create index if not exists idx_gstr2b_records_supplier_gstin on public.gstr2b_records (supplier_gstin);
create index if not exists idx_gstr2b_records_doc_no_norm on public.gstr2b_records (doc_no_norm);
create index if not exists idx_gstr2b_records_match on public.gstr2b_records (supplier_gstin, doc_no_norm);

-- Trigger: set_updated_at on public.gstr2b_records
create trigger trg_gstr2b_records_set_updated_at
  before update on public.gstr2b_records
  for each row
  execute function public.set_updated_at();

-- =============================================================================
-- Row Level Security: Deny by default, explicit policies
-- =============================================================================
alter table public.gstr2b_imports enable row level security;
alter table public.gstr2b_records enable row level security;

-- Policies for public.gstr2b_imports
-- Select: firm members or platform admin
create policy "gstr2b_imports_select_firm_member"
  on public.gstr2b_imports
  for select
  using (
    public.is_firm_member(firm_id) or public.is_platform_admin()
  );

-- Insert: firm members or platform admin
create policy "gstr2b_imports_insert_firm_member"
  on public.gstr2b_imports
  for insert
  with check (
    public.is_firm_member(firm_id) or public.is_platform_admin()
  );

-- Update: firm members or platform admin
create policy "gstr2b_imports_update_firm_member"
  on public.gstr2b_imports
  for update
  using (
    public.is_firm_member(firm_id) or public.is_platform_admin()
  )
  with check (
    public.is_firm_member(firm_id) or public.is_platform_admin()
  );

-- Delete: firm admins or platform admin
create policy "gstr2b_imports_delete_firm_admin"
  on public.gstr2b_imports
  for delete
  using (
    public.is_firm_admin(firm_id) or public.is_platform_admin()
  );

-- Policies for public.gstr2b_records
-- Select: via import firm member or platform admin
create policy "gstr2b_records_select_import_member"
  on public.gstr2b_records
  for select
  using (
    exists (
      select 1
      from public.gstr2b_imports imp
      where imp.id = gstr2b_records.import_id
        and (public.is_firm_member(imp.firm_id) or public.is_platform_admin())
    )
  );

-- Insert: via import firm member or platform admin
create policy "gstr2b_records_insert_import_member"
  on public.gstr2b_records
  for insert
  with check (
    exists (
      select 1
      from public.gstr2b_imports imp
      where imp.id = gstr2b_records.import_id
        and (public.is_firm_member(imp.firm_id) or public.is_platform_admin())
    )
  );

-- Update: via import firm member or platform admin
create policy "gstr2b_records_update_import_member"
  on public.gstr2b_records
  for update
  using (
    exists (
      select 1
      from public.gstr2b_imports imp
      where imp.id = gstr2b_records.import_id
        and (public.is_firm_member(imp.firm_id) or public.is_platform_admin())
    )
  )
  with check (
    exists (
      select 1
      from public.gstr2b_imports imp
      where imp.id = gstr2b_records.import_id
        and (public.is_firm_member(imp.firm_id) or public.is_platform_admin())
    )
  );

-- Delete: via import firm admin or platform admin
create policy "gstr2b_records_delete_import_admin"
  on public.gstr2b_records
  for delete
  using (
    exists (
      select 1
      from public.gstr2b_imports imp
      where imp.id = gstr2b_records.import_id
        and (public.is_firm_admin(imp.firm_id) or public.is_platform_admin())
    )
  );
