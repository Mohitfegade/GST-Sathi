-- pgTAP Test Suite: RLS & RPCs for Uploads Support
-- Verifies:
-- 1. Setup & Function Signatures
-- 2. check_upload_quota:
--    - Initial count 0 returns true for n=10, n=100.
--    - When 100 documents are inserted within past hour for client A, check_upload_quota(client_A, 1) returns false.
--    - check_upload_quota for client B is unaffected (returns true).
-- 3. cleanup_stale_uploads:
--    - Insert 'uploaded' document older than 2 hours for client A.
--    - Insert 'uploaded' document 10 minutes old for client A.
--    - Insert 'uploaded' document older than 2 hours for client B.
--    - Call cleanup_stale_uploads(client_A).
--    - Verify only stale document for client A is cleaned up (deleted_at is set).
--    - Verify fresh document and client B's document are NOT touched.
-- 4. confirm_document_upload:
--    - Fails when caller is not authenticated or not the uploader.
--    - Fails when storage object is missing from storage.objects.
--    - Succeeds when caller is the uploader, storage object is in storage.objects, and doc status is 'uploaded' -> transitions to 'queued'.
-- 5. fail_document_upload:
--    - Transitions document to 'failed'.
-- 6. RLS on documents:
--    - Owner cannot select documents of another client.
--    - Non-firm member cannot select firm documents.

begin;

-- Initialize pgTAP plan (46 tests)
select plan(46);

-- ============================================================================
-- 0. Environment Setup & Grants
-- ============================================================================

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage on schema storage to anon, authenticated;
grant select, insert, update, delete on storage.objects to anon, authenticated;
grant select on storage.buckets to anon, authenticated;

-- ============================================================================
-- 1. Test Fixtures Setup (Run as Superuser / postgres)
-- ============================================================================

-- Test Users:
-- Firm A Admin:    a0000000-0000-0000-0000-000000000001
-- Firm A Staff:    a0000000-0000-0000-0000-000000000002
-- Firm B Admin:    b0000000-0000-0000-0000-000000000001
-- Client Owner A:  c0000000-0000-0000-0000-000000000001
-- Client Owner B:  c0000000-0000-0000-0000-000000000002
-- Outsider:        e0000000-0000-0000-0000-000000000001

insert into auth.users (id, aud, role, email)
values
  ('a0000000-0000-0000-0000-000000000001'::uuid, 'authenticated', 'authenticated', 'firm_a_admin@test.local'),
  ('a0000000-0000-0000-0000-000000000002'::uuid, 'authenticated', 'authenticated', 'firm_a_staff@test.local'),
  ('b0000000-0000-0000-0000-000000000001'::uuid, 'authenticated', 'authenticated', 'firm_b_admin@test.local'),
  ('c0000000-0000-0000-0000-000000000001'::uuid, 'authenticated', 'authenticated', 'client_owner_a@test.local'),
  ('c0000000-0000-0000-0000-000000000002'::uuid, 'authenticated', 'authenticated', 'client_owner_b@test.local'),
  ('e0000000-0000-0000-0000-000000000001'::uuid, 'authenticated', 'authenticated', 'outsider@test.local')
on conflict (id) do nothing;

-- Test Firms: Firm A & Firm B
insert into public.firms (id, name, created_by)
values
  ('11111111-1111-1111-1111-111111111111'::uuid, 'Test CA Firm A', 'a0000000-0000-0000-0000-000000000001'::uuid),
  ('22222222-2222-2222-2222-222222222222'::uuid, 'Test CA Firm B', 'b0000000-0000-0000-0000-000000000001'::uuid)
on conflict (id) do nothing;

-- Firm Members:
insert into public.firm_members (firm_id, user_id, role)
values
  ('11111111-1111-1111-1111-111111111111'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, 'admin'),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'a0000000-0000-0000-0000-000000000002'::uuid, 'staff'),
  ('22222222-2222-2222-2222-222222222222'::uuid, 'b0000000-0000-0000-0000-000000000001'::uuid, 'admin')
on conflict (firm_id, user_id) do nothing;

-- Clients: Client A under Firm A, Client B under Firm B
insert into public.clients (id, firm_id, legal_name, trade_name, gstin, state_code, scheme, aato_band)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'Client A Retail', 'Client A Store', '27AAAAA1111A1Z1', '27', 'regular', 'below_40l'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, 'Client B Mart', 'Client B Shop', '27BBBBB2222B1Z2', '27', 'regular', 'below_40l')
on conflict (id) do nothing;

-- Client Access:
insert into public.client_access (firm_id, client_id, user_id, role)
values
  ('11111111-1111-1111-1111-111111111111'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'c0000000-0000-0000-0000-000000000001'::uuid, 'owner'),
  ('22222222-2222-2222-2222-222222222222'::uuid, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, 'c0000000-0000-0000-0000-000000000002'::uuid, 'owner')
on conflict (client_id, user_id) do nothing;

-- Storage Bucket: documents
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Setup Verifications (Tests 1-8)
select results_eq(
  'select count(*)::integer from public.firms where id in (''11111111-1111-1111-1111-111111111111'', ''22222222-2222-2222-2222-222222222222'')',
  array[2],
  'Setup: Both test firms exist'
);

select results_eq(
  'select count(*)::integer from public.clients where id in (''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'', ''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'')',
  array[2],
  'Setup: Both test clients exist'
);

select results_eq(
  'select count(*)::integer from public.client_access where client_id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'' and user_id = ''c0000000-0000-0000-0000-000000000001''',
  array[1],
  'Setup: Client Owner A has owner access to Client A'
);

select results_eq(
  'select count(*)::integer from storage.buckets where id = ''documents''',
  array[1],
  'Setup: Private documents storage bucket exists'
);

select has_function('public', 'check_upload_quota', array['uuid', 'integer'], 'Function check_upload_quota(uuid, integer) exists');
select has_function('public', 'cleanup_stale_uploads', array['uuid'], 'Function cleanup_stale_uploads(uuid) exists');
select has_function('public', 'confirm_document_upload', array['uuid'], 'Function confirm_document_upload(uuid) exists');
select has_function('public', 'fail_document_upload', array['uuid', 'text'], 'Function fail_document_upload(uuid, text) exists');

-- ============================================================================
-- 2. Quota Check Function: check_upload_quota (Tests 9-17)
-- ============================================================================

-- Initial count 0 returns true for n=10, n=100
select results_eq(
  'select public.check_upload_quota(''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''::uuid, 10)',
  array[true],
  'check_upload_quota: Initial count 0 allows batch of 10 for Client A'
);

select results_eq(
  'select public.check_upload_quota(''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''::uuid, 100)',
  array[true],
  'check_upload_quota: Initial count 0 allows batch of 100 for Client A'
);

select results_eq(
  'select public.check_upload_quota(''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''::uuid, 101)',
  array[false],
  'check_upload_quota: Initial count 0 rejects batch of 101 exceeding 100 limit'
);

-- Insert 100 documents for Client A within the past hour
select lives_ok(
  $$insert into public.documents (
      id, firm_id, client_id, kind, storage_path, original_name, mime_type, size_bytes, sha256, status, uploaded_by, created_at
    )
    select
      gen_random_uuid(),
      '11111111-1111-1111-1111-111111111111'::uuid,
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
      'purchase_bill'::public.doc_kind,
      '11111111-1111-1111-1111-111111111111/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/quota_bill_' || i || '.pdf',
      'quota_bill_' || i || '.pdf',
      'application/pdf',
      1024,
      lpad(to_hex(i), 64, '0'),
      'uploaded'::public.doc_status,
      'a0000000-0000-0000-0000-000000000002'::uuid,
      clock_timestamp() - (i || ' seconds')::interval
    from generate_series(1, 100) as i$$,
  'check_upload_quota: Inserted 100 documents within past hour for Client A'
);

select results_eq(
  'select count(*)::integer from public.documents where client_id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'' and created_at >= clock_timestamp() - interval ''1 hour'' and deleted_at is null',
  array[100],
  'check_upload_quota: Client A has exactly 100 active documents in past hour'
);

-- Client A quota is now exhausted: check_upload_quota(client_A, 1) returns false
select results_eq(
  'select public.check_upload_quota(''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''::uuid, 1)',
  array[false],
  'check_upload_quota: check_upload_quota(client_A, 1) returns false when 100 documents exist in past hour'
);

-- Client B quota is unaffected: check_upload_quota for client B returns true
select results_eq(
  'select public.check_upload_quota(''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb''::uuid, 1)',
  array[true],
  'check_upload_quota: check_upload_quota(client_B, 1) returns true (unaffected by Client A)'
);

select results_eq(
  'select public.check_upload_quota(''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb''::uuid, 100)',
  array[true],
  'check_upload_quota: check_upload_quota(client_B, 100) returns true'
);

-- Soft-deleting 10 documents for Client A frees quota
update public.documents
set deleted_at = clock_timestamp()
where client_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
  and sha256 in (select lpad(to_hex(i), 64, '0') from generate_series(1, 10) as i);

select results_eq(
  'select public.check_upload_quota(''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''::uuid, 10)',
  array[true],
  'check_upload_quota: Soft-deleted documents do not count against quota (frees up slots)'
);

-- Clean up quota documents before stale cleanup tests
delete from public.documents where client_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;

-- ============================================================================
-- 3. Stale Uploads Cleanup: cleanup_stale_uploads (Tests 18-25)
-- ============================================================================

-- Requirements:
-- - Insert an 'uploaded' document older than 2 hours for client A.
-- - Insert an 'uploaded' document 10 minutes old for client A.
-- - Insert an 'uploaded' document older than 2 hours for client B.

select lives_ok(
  $$insert into public.documents (
      id, firm_id, client_id, kind, storage_path, original_name, mime_type, size_bytes, sha256, status, uploaded_by, created_at
    )
    values (
      'd1000000-0000-0000-0000-000000000001'::uuid,
      '11111111-1111-1111-1111-111111111111'::uuid,
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
      'purchase_bill'::public.doc_kind,
      '11111111-1111-1111-1111-111111111111/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/stale_a.pdf',
      'stale_a.pdf',
      'application/pdf',
      1024,
      lpad('stale_a', 64, '0'),
      'uploaded'::public.doc_status,
      'a0000000-0000-0000-0000-000000000002'::uuid,
      clock_timestamp() - interval '2 hours'
    )$$,
  'cleanup_stale_uploads: Seeded stale document (>2 hours old) for Client A'
);

select lives_ok(
  $$insert into public.documents (
      id, firm_id, client_id, kind, storage_path, original_name, mime_type, size_bytes, sha256, status, uploaded_by, created_at
    )
    values (
      'd1000000-0000-0000-0000-000000000002'::uuid,
      '11111111-1111-1111-1111-111111111111'::uuid,
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
      'purchase_bill'::public.doc_kind,
      '11111111-1111-1111-1111-111111111111/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/fresh_a.pdf',
      'fresh_a.pdf',
      'application/pdf',
      1024,
      lpad('fresh_a', 64, '0'),
      'uploaded'::public.doc_status,
      'a0000000-0000-0000-0000-000000000002'::uuid,
      clock_timestamp() - interval '10 minutes'
    )$$,
  'cleanup_stale_uploads: Seeded fresh document (10 minutes old) for Client A'
);

select lives_ok(
  $$insert into public.documents (
      id, firm_id, client_id, kind, storage_path, original_name, mime_type, size_bytes, sha256, status, uploaded_by, created_at
    )
    values (
      'd2000000-0000-0000-0000-000000000001'::uuid,
      '22222222-2222-2222-2222-222222222222'::uuid,
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
      'purchase_bill'::public.doc_kind,
      '22222222-2222-2222-2222-222222222222/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/stale_b.pdf',
      'stale_b.pdf',
      'application/pdf',
      1024,
      lpad('stale_b', 64, '0'),
      'uploaded'::public.doc_status,
      'b0000000-0000-0000-0000-000000000001'::uuid,
      clock_timestamp() - interval '2 hours'
    )$$,
  'cleanup_stale_uploads: Seeded stale document (>2 hours old) for Client B'
);

-- Call cleanup_stale_uploads(client_A)
select results_eq(
  'select public.cleanup_stale_uploads(''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''::uuid)',
  array[1],
  'cleanup_stale_uploads: cleanup_stale_uploads(client_A) reports exactly 1 stale document cleaned'
);

-- Verify only the stale document for client A is cleaned up (deleted_at is set)
select results_eq(
  'select (deleted_at is not null) from public.documents where id = ''d1000000-0000-0000-0000-000000000001''::uuid',
  array[true],
  'cleanup_stale_uploads: Stale document for Client A has deleted_at set'
);

-- Verify fresh document and client B's document are NOT touched
select results_eq(
  'select (deleted_at is null) from public.documents where id = ''d1000000-0000-0000-0000-000000000002''::uuid',
  array[true],
  'cleanup_stale_uploads: Fresh document for Client A has deleted_at IS NULL (NOT touched)'
);

select results_eq(
  'select (deleted_at is null) from public.documents where id = ''d2000000-0000-0000-0000-000000000001''::uuid',
  array[true],
  'cleanup_stale_uploads: Stale document for Client B has deleted_at IS NULL (NOT touched by client A cleanup)'
);

-- Idempotent check
select results_eq(
  'select public.cleanup_stale_uploads(''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''::uuid)',
  array[0],
  'cleanup_stale_uploads: Subsequent call cleans up 0 additional documents (idempotent)'
);

-- ============================================================================
-- 4. Confirm Document Upload: confirm_document_upload (Tests 26-34)
-- ============================================================================

-- Seed document for confirm_document_upload test
-- Uploaded by Client Owner A
select lives_ok(
  $$insert into public.documents (
      id, firm_id, client_id, kind, storage_path, original_name, mime_type, size_bytes, sha256, status, uploaded_by, created_at
    )
    values (
      'd1000000-0000-0000-0000-000000000010'::uuid,
      '11111111-1111-1111-1111-111111111111'::uuid,
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
      'purchase_bill'::public.doc_kind,
      '11111111-1111-1111-1111-111111111111/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/confirm_test.pdf',
      'confirm_test.pdf',
      'application/pdf',
      2048,
      lpad('confirm_test', 64, '0'),
      'uploaded'::public.doc_status,
      'c0000000-0000-0000-0000-000000000001'::uuid,
      clock_timestamp()
    )$$,
  'confirm_document_upload: Seeded uploaded document awaiting confirmation'
);

-- Test 27: Fails when caller is not authenticated
set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);

select throws_ok(
  $$select public.confirm_document_upload('d1000000-0000-0000-0000-000000000010'::uuid)$$,
  'P0001',
  'Not authenticated',
  'confirm_document_upload: Fails when caller is unauthenticated (anon)'
);

-- Test 28: Fails when caller is outsider (not uploader and no firm/client access)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "e0000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
select set_config('request.jwt.claim.sub', 'e0000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select throws_ok(
  $$select public.confirm_document_upload('d1000000-0000-0000-0000-000000000010'::uuid)$$,
  'P0001',
  'Access denied',
  'confirm_document_upload: Fails when caller is outsider'
);

-- Test 29: Fails when caller is owner of a different client (Client Owner B)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "c0000000-0000-0000-0000-000000000002", "role": "authenticated"}', true);
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select throws_ok(
  $$select public.confirm_document_upload('d1000000-0000-0000-0000-000000000010'::uuid)$$,
  'P0001',
  'Access denied',
  'confirm_document_upload: Fails when caller is Client Owner B (cross-client access denied)'
);

-- Test 30: Fails when storage object is missing from storage.objects
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "c0000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select throws_ok(
  $$select public.confirm_document_upload('d1000000-0000-0000-0000-000000000010'::uuid)$$,
  'P0001',
  'Storage object does not exist',
  'confirm_document_upload: Fails when storage object is missing from storage.objects'
);

-- Test 31: Insert storage object into storage.objects
set local role postgres;
select set_config('request.jwt.claims', null, true);
select set_config('request.jwt.claim.sub', null, true);
select set_config('request.jwt.claim.role', null, true);

select lives_ok(
  $$insert into storage.objects (id, bucket_id, name)
    values (
      '50100000-0000-0000-0000-000000000010'::uuid,
      'documents',
      '11111111-1111-1111-1111-111111111111/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/confirm_test.pdf'
    )$$,
  'confirm_document_upload: Inserted matching storage object in documents bucket'
);

-- Test 32: Succeeds when caller is the uploader and storage object exists
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "c0000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select lives_ok(
  $$select public.confirm_document_upload('d1000000-0000-0000-0000-000000000010'::uuid)$$,
  'confirm_document_upload: Succeeds when caller is uploader and storage object is present'
);

-- Test 33: Document status transitions to 'queued'
select results_eq(
  'select status from public.documents where id = ''d1000000-0000-0000-0000-000000000010''::uuid',
  array['queued'::public.doc_status],
  'confirm_document_upload: Document status successfully transitioned from uploaded to queued'
);

-- Test 34: Idempotent confirmation returns ok when already queued
select lives_ok(
  $$select public.confirm_document_upload('d1000000-0000-0000-0000-000000000010'::uuid)$$,
  'confirm_document_upload: Idempotent confirmation on queued document succeeds'
);

-- ============================================================================
-- 5. Fail Document Upload: fail_document_upload (Tests 35-39)
-- ============================================================================

set local role postgres;
select set_config('request.jwt.claims', null, true);
select set_config('request.jwt.claim.sub', null, true);
select set_config('request.jwt.claim.role', null, true);

-- Seed document for fail_document_upload test
select lives_ok(
  $$insert into public.documents (
      id, firm_id, client_id, kind, storage_path, original_name, mime_type, size_bytes, sha256, status, uploaded_by, created_at
    )
    values (
      'd1000000-0000-0000-0000-000000000020'::uuid,
      '11111111-1111-1111-1111-111111111111'::uuid,
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
      'purchase_bill'::public.doc_kind,
      '11111111-1111-1111-1111-111111111111/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/fail_test.pdf',
      'fail_test.pdf',
      'application/pdf',
      2048,
      lpad('fail_test', 64, '0'),
      'uploaded'::public.doc_status,
      'c0000000-0000-0000-0000-000000000001'::uuid,
      clock_timestamp()
    )$$,
  'fail_document_upload: Seeded document awaiting failure handling'
);

-- Test 36: Unauthenticated caller fails
set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);

select throws_ok(
  $$select public.fail_document_upload('d1000000-0000-0000-0000-000000000020'::uuid, 'Invalid magic bytes')$$,
  'P0001',
  'Not authenticated',
  'fail_document_upload: Fails when caller is unauthenticated'
);

-- Test 37: Outsider caller fails
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "e0000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
select set_config('request.jwt.claim.sub', 'e0000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select throws_ok(
  $$select public.fail_document_upload('d1000000-0000-0000-0000-000000000020'::uuid, 'Invalid magic bytes')$$,
  'P0001',
  'Access denied',
  'fail_document_upload: Fails when caller is outsider'
);

-- Test 38: Uploader marks document as failed
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "c0000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select lives_ok(
  $$select public.fail_document_upload('d1000000-0000-0000-0000-000000000020'::uuid, 'Unsupported file format: invalid magic bytes')$$,
  'fail_document_upload: Uploader successfully marks upload as failed'
);

-- Test 39: Document status transitions to 'failed'
select results_eq(
  'select status from public.documents where id = ''d1000000-0000-0000-0000-000000000020''::uuid',
  array['failed'::public.doc_status],
  'fail_document_upload: Document status is now failed'
);

-- ============================================================================
-- 6. RLS on Documents (Tests 40-46)
-- ============================================================================

-- Client Owner A context
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "c0000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

-- Test 40: Owner can select documents of own client
select results_eq(
  'select count(*)::integer from public.documents where client_id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''::uuid',
  array[4],
  'RLS documents: Client Owner A can select documents of own client (Client A)'
);

-- Test 41: Owner CANNOT select documents of another client (Client B)
select is_empty(
  'select * from public.documents where client_id = ''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb''::uuid',
  'RLS documents: Client Owner A cannot select documents belonging to Client B (empty set)'
);

-- Test 42: Owner selecting specific document ID of another client returns empty set
select is_empty(
  'select * from public.documents where id = ''d2000000-0000-0000-0000-000000000001''::uuid',
  'RLS documents: Client Owner A cannot select document d2000000 (belonging to Client B)'
);

-- Outsider context
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "e0000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
select set_config('request.jwt.claim.sub', 'e0000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

-- Test 43: Non-firm member / Outsider cannot select Firm A documents
select is_empty(
  'select * from public.documents where firm_id = ''11111111-1111-1111-1111-111111111111''::uuid',
  'RLS documents: Non-firm member cannot select Firm A documents (empty set)'
);

-- Test 44: Non-firm member / Outsider cannot select Firm B documents
select is_empty(
  'select * from public.documents where firm_id = ''22222222-2222-2222-2222-222222222222''::uuid',
  'RLS documents: Non-firm member cannot select Firm B documents (empty set)'
);

-- Firm A Staff context
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "a0000000-0000-0000-0000-000000000002", "role": "authenticated"}', true);
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

-- Test 45: Firm A Staff can select Firm A documents
select results_eq(
  'select count(*)::integer from public.documents where firm_id = ''11111111-1111-1111-1111-111111111111''::uuid',
  array[4],
  'RLS documents: Firm A staff can select Firm A documents'
);

-- Test 46: Firm A Staff CANNOT select Firm B documents (cross-firm isolation)
select is_empty(
  'select * from public.documents where firm_id = ''22222222-2222-2222-2222-222222222222''::uuid',
  'RLS documents: Firm A staff cannot select Firm B documents (empty set)'
);

-- ============================================================================
-- Finish pgTAP Test Suite
-- ============================================================================

rollback;
