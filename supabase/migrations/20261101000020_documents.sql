-- Migration 020: Documents
-- Documents table, storage bucket, indexes, trigger, and RLS policies

-- ============================================================================
-- 1. Documents Table
-- ============================================================================

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  kind public.doc_kind not null,
  storage_path text not null,
  original_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  sha256 text not null check (length(sha256) = 64),
  status public.doc_status not null default 'uploaded',
  uploaded_by uuid references auth.users(id) on delete set null,
  period_fp text check (period_fp is null or (length(period_fp) = 6 and period_fp ~ '^(0[1-9]|1[0-2])[0-9]{4}$')),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz
);

-- Active document unique by client_id and sha256
create unique index uq_documents_client_sha256_active
  on public.documents (client_id, sha256)
  where deleted_at is null;

-- ============================================================================
-- 2. Indexes
-- ============================================================================

create index idx_documents_firm_id on public.documents (firm_id);
create index idx_documents_client_id on public.documents (client_id);
create index idx_documents_period_fp on public.documents (period_fp);
create index idx_documents_status on public.documents (status);
create index idx_documents_kind on public.documents (kind);

-- ============================================================================
-- 3. Trigger
-- ============================================================================

create trigger set_documents_updated_at
  before update on public.documents
  for each row
  execute function public.set_updated_at();

-- ============================================================================
-- 4. RLS on documents (deny by default)
-- ============================================================================

alter table public.documents enable row level security;

create policy "documents_select"
  on public.documents
  for select
  using (
    public.is_firm_member(firm_id)
    or public.is_client_owner(client_id)
    or public.is_platform_admin()
  );

create policy "documents_insert"
  on public.documents
  for insert
  with check (
    public.is_firm_member(firm_id)
    or (public.is_client_owner(client_id) and kind in ('purchase_bill', 'sales_file'))
    or public.is_platform_admin()
  );

create policy "documents_update"
  on public.documents
  for update
  using (
    public.is_firm_member(firm_id)
    or public.is_platform_admin()
  )
  with check (
    public.is_firm_member(firm_id)
    or public.is_platform_admin()
  );

create policy "documents_delete"
  on public.documents
  for delete
  using (
    public.is_firm_admin(firm_id)
    or public.is_platform_admin()
  );

-- ============================================================================
-- 5. Storage Bucket & Policies
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy "documents_storage_select"
  on storage.objects
  for select
  using (
    bucket_id = 'documents'
    and (
      public.is_firm_member((storage.foldername(name))[1]::uuid)
      or public.is_client_owner((storage.foldername(name))[2]::uuid)
      or public.is_platform_admin()
    )
  );

create policy "documents_storage_insert"
  on storage.objects
  for insert
  with check (
    bucket_id = 'documents'
    and (
      public.is_firm_member((storage.foldername(name))[1]::uuid)
      or public.is_client_owner((storage.foldername(name))[2]::uuid)
      or public.is_platform_admin()
    )
  );

create policy "documents_storage_update"
  on storage.objects
  for update
  using (
    bucket_id = 'documents'
    and (
      public.is_firm_member((storage.foldername(name))[1]::uuid)
      or public.is_platform_admin()
    )
  )
  with check (
    bucket_id = 'documents'
    and (
      public.is_firm_member((storage.foldername(name))[1]::uuid)
      or public.is_platform_admin()
    )
  );

create policy "documents_storage_delete"
  on storage.objects
  for delete
  using (
    bucket_id = 'documents'
    and (
      public.is_firm_admin((storage.foldername(name))[1]::uuid)
      or public.is_platform_admin()
    )
  );
