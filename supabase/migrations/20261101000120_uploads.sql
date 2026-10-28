-- Migration 120: Uploads Support
-- Indexing, quota check function, stale cleanup function, and security-definer RPCs
-- for direct-to-storage document uploads.

-- ============================================================================
-- 1. Index on public.documents
-- ============================================================================

create index if not exists idx_documents_client_status_created
  on public.documents (client_id, status, created_at);

-- ============================================================================
-- 2. Quota Check Function: check_upload_quota
-- ============================================================================

create or replace function public.check_upload_quota(
  client_id_param uuid,
  n int default 1
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_count integer;
begin
  select count(*)
  into current_count
  from public.documents
  where client_id = client_id_param
    and created_at >= clock_timestamp() - interval '1 hour'
    and deleted_at is null;

  if (current_count + coalesce(n, 1)) > 100 then
    return false;
  end if;

  return true;
end;
$$;

comment on function public.check_upload_quota(uuid, int) is
  'Verifies if adding n documents in the current 1-hour window stays within client quota (max 100/hr).';

-- ============================================================================
-- 3. Stale Uploads Cleanup: cleanup_stale_uploads
-- ============================================================================

create or replace function public.cleanup_stale_uploads(client_id_param uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  cleaned_count integer := 0;
begin
  with stale as (
    update public.documents
    set deleted_at = clock_timestamp(),
        updated_at = clock_timestamp()
    where client_id = client_id_param
      and status = 'uploaded'
      and created_at < clock_timestamp() - interval '1 hour'
      and deleted_at is null
    returning id
  )
  select count(*) into cleaned_count from stale;

  return cleaned_count;
end;
$$;

comment on function public.cleanup_stale_uploads(uuid) is
  'Soft-deletes documents left in unconfirmed uploaded status past 1 hour for a given client.';

-- ============================================================================
-- 4. Confirm Document Upload: confirm_document_upload
-- ============================================================================

create or replace function public.confirm_document_upload(document_id_param uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d record;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into d
  from public.documents
  where id = document_id_param
    and deleted_at is null
  for update;

  if not found then
    raise exception 'Document not found';
  end if;

  -- Verify access to the client
  if not (
    public.is_firm_member(d.firm_id)
    or public.is_client_owner(d.client_id)
    or public.is_platform_admin()
  ) then
    raise exception 'Access denied';
  end if;

  -- Verify uploader identity or firm membership
  if not (
    d.uploaded_by = auth.uid()
    or public.is_firm_member(d.firm_id)
    or public.is_platform_admin()
  ) then
    raise exception 'Access denied';
  end if;

  -- Status check: idempotent if already queued, error if not uploaded
  if d.status = 'queued' then
    return jsonb_build_object(
      'ok', true,
      'id', d.id,
      'status', 'queued'
    );
  end if;

  if d.status <> 'uploaded' then
    raise exception 'Document status is not uploaded (current status: %)', d.status;
  end if;

  -- Verify storage object existence in documents bucket
  if not exists (
    select 1
    from storage.objects
    where bucket_id = 'documents'
      and name = d.storage_path
  ) then
    raise exception 'Storage object does not exist';
  end if;

  -- Advance document status to queued
  update public.documents
  set status = 'queued',
      updated_at = clock_timestamp()
  where id = document_id_param;

  return jsonb_build_object(
    'ok', true,
    'id', d.id,
    'status', 'queued'
  );
end;
$$;

comment on function public.confirm_document_upload(uuid) is
  'Confirms a direct-to-storage upload, verifies storage object existence, and advances status to queued.';

-- ============================================================================
-- 5. Fail Document Upload: fail_document_upload
-- ============================================================================

create or replace function public.fail_document_upload(
  document_id_param uuid,
  reason text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d record;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into d
  from public.documents
  where id = document_id_param
    and deleted_at is null
  for update;

  if not found then
    raise exception 'Document not found';
  end if;

  -- Verify access to the client
  if not (
    public.is_firm_member(d.firm_id)
    or public.is_client_owner(d.client_id)
    or public.is_platform_admin()
  ) then
    raise exception 'Access denied';
  end if;

  -- Verify uploader identity or firm membership
  if not (
    d.uploaded_by = auth.uid()
    or public.is_firm_member(d.firm_id)
    or public.is_platform_admin()
  ) then
    raise exception 'Access denied';
  end if;

  -- Transition document status to failed
  update public.documents
  set status = 'failed',
      updated_at = clock_timestamp()
  where id = document_id_param;

  return jsonb_build_object(
    'ok', true,
    'id', d.id,
    'status', 'failed',
    'reason', coalesce(reason, '')
  );
end;
$$;

comment on function public.fail_document_upload(uuid, text) is
  'Marks a document upload as failed with an optional error reason.';

-- ============================================================================
-- 6. Function Permissions
-- ============================================================================

grant execute on function public.check_upload_quota(uuid, int) to authenticated, anon;
grant execute on function public.cleanup_stale_uploads(uuid) to authenticated, anon;
grant execute on function public.confirm_document_upload(uuid) to authenticated, anon;
grant execute on function public.fail_document_upload(uuid, text) to authenticated, anon;
