-- Migration 040: Extraction
-- Extraction fields table, indexes, trigger, and RLS policies

-- ============================================================================
-- 1. Extraction Fields Table
-- ============================================================================

create table public.extraction_fields (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete cascade,
  field_path text not null, -- e.g. 'invoice_no', 'invoice_date', 'total', 'lines[0].hsn'
  ai_initial_value text,
  confidence numeric(4,3) check (confidence >= 0 and confidence <= 1.000),
  bbox jsonb, -- bounding box {x, y, w, h}
  final_value text,
  modified_by uuid references auth.users(id) on delete set null,
  modified_at timestamptz,
  model_version text,
  rule_snapshot_id uuid,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz
);

comment on table public.extraction_fields is 'AI-extracted and user-corrected field values with confidence and bounding boxes from ingested documents.';
comment on column public.extraction_fields.document_id is 'Source document from which the field was extracted.';
comment on column public.extraction_fields.invoice_id is 'Associated purchase invoice record, if one has been generated or linked.';
comment on column public.extraction_fields.field_path is 'Normalized path of the field (e.g. invoice_no, invoice_date, total, lines[0].hsn).';
comment on column public.extraction_fields.confidence is 'AI extraction confidence score between 0.000 and 1.000.';
comment on column public.extraction_fields.bbox is 'Bounding box {x, y, w, h} coordinates on the document.';
comment on column public.extraction_fields.final_value is 'Final verified/corrected value after human-in-the-loop review.';

-- ============================================================================
-- 2. Indexes
-- ============================================================================

create index idx_extraction_fields_document_id on public.extraction_fields (document_id);
create index idx_extraction_fields_invoice_id on public.extraction_fields (invoice_id);
create index idx_extraction_fields_field_path on public.extraction_fields (field_path);

-- ============================================================================
-- 3. Trigger
-- ============================================================================

create trigger set_extraction_fields_updated_at
  before update on public.extraction_fields
  for each row
  execute function public.set_updated_at();

-- ============================================================================
-- 4. Row Level Security (RLS)
-- ============================================================================

alter table public.extraction_fields enable row level security;

-- Select policy: firm member of the document's firm or platform admin
create policy "extraction_fields_select"
  on public.extraction_fields
  for select
  using (
    exists (
      select 1
      from public.documents d
      where d.id = extraction_fields.document_id
        and (
          public.is_firm_member(d.firm_id)
          or public.is_platform_admin()
        )
    )
  );

-- Insert policy: firm member of the document's firm or platform admin
create policy "extraction_fields_insert"
  on public.extraction_fields
  for insert
  with check (
    exists (
      select 1
      from public.documents d
      where d.id = extraction_fields.document_id
        and (
          public.is_firm_member(d.firm_id)
          or public.is_platform_admin()
        )
    )
  );

-- Update policy: firm member of the document's firm or platform admin
create policy "extraction_fields_update"
  on public.extraction_fields
  for update
  using (
    exists (
      select 1
      from public.documents d
      where d.id = extraction_fields.document_id
        and (
          public.is_firm_member(d.firm_id)
          or public.is_platform_admin()
        )
    )
  )
  with check (
    exists (
      select 1
      from public.documents d
      where d.id = extraction_fields.document_id
        and (
          public.is_firm_member(d.firm_id)
          or public.is_platform_admin()
        )
    )
  );

-- Delete policy: firm admin of the document's firm or platform admin
create policy "extraction_fields_delete"
  on public.extraction_fields
  for delete
  using (
    exists (
      select 1
      from public.documents d
      where d.id = extraction_fields.document_id
        and (
          public.is_firm_admin(d.firm_id)
          or public.is_platform_admin()
        )
    )
  );
