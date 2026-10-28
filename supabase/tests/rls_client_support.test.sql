-- pgTAP Test Suite: RLS & Lifecycle Operations for Client Support
-- Verifies:
-- 1. Duplicate GSTIN rejected among active clients in the same firm (uq_clients_firm_gstin_active)
-- 2. Archived GSTIN reusable: soft-deleting client 1 allows client 2 in same firm with exact same GSTIN
-- 3. Staff cannot archive: when authenticated as firm staff, updating deleted_at fails (trigger throws exception)
-- 4. Firm admin can archive and restore clients successfully
-- 5. Cross-firm invite revoke/delete is impossible: firm B admin cannot delete/revoke firm A invite
-- 6. Accepted invite cannot be revoked or deleted: when accepted_at is set, delete/update affects 0 rows

begin;

-- Initialize pgTAP plan (30 tests)
select plan(30);

-- ============================================================================
-- 0. Environment Setup & Grants
-- ============================================================================

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;

-- ============================================================================
-- 1. Test Fixtures Setup (Run as Superuser / postgres)
-- ============================================================================

-- Test Users:
-- Firm A Admin:    a0000000-0000-0000-0000-000000000001
-- Firm A Staff:    a0000000-0000-0000-0000-000000000002
-- Firm B Admin:    b0000000-0000-0000-0000-000000000001
-- Client Owner A:  c0000000-0000-0000-0000-000000000001
-- Outsider:        e0000000-0000-0000-0000-000000000001

insert into auth.users (id, aud, role, email)
values
  ('a0000000-0000-0000-0000-000000000001'::uuid, 'authenticated', 'authenticated', 'firm_a_admin@test.local'),
  ('a0000000-0000-0000-0000-000000000002'::uuid, 'authenticated', 'authenticated', 'firm_a_staff@test.local'),
  ('b0000000-0000-0000-0000-000000000001'::uuid, 'authenticated', 'authenticated', 'firm_b_admin@test.local'),
  ('c0000000-0000-0000-0000-000000000001'::uuid, 'authenticated', 'authenticated', 'client_owner_a@test.local'),
  ('e0000000-0000-0000-0000-000000000001'::uuid, 'authenticated', 'authenticated', 'outsider@test.local')
on conflict (id) do nothing;

-- Test Firms: Firm A & Firm B
insert into public.firms (id, name, created_by)
values
  ('11111111-1111-1111-1111-111111111111'::uuid, 'Test CA Firm A', 'a0000000-0000-0000-0000-000000000001'::uuid),
  ('22222222-2222-2222-2222-222222222222'::uuid, 'Test CA Firm B', 'b0000000-0000-0000-0000-000000000001'::uuid)
on conflict (id) do nothing;

-- Firm Members: Firm A (Admin, Staff), Firm B (Admin)
insert into public.firm_members (firm_id, user_id, role)
values
  ('11111111-1111-1111-1111-111111111111'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, 'admin'),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'a0000000-0000-0000-0000-000000000002'::uuid, 'staff'),
  ('22222222-2222-2222-2222-222222222222'::uuid, 'b0000000-0000-0000-0000-000000000001'::uuid, 'admin')
on conflict (firm_id, user_id) do nothing;

-- Seed Base Clients: Client A1 under Firm A, Client B1 under Firm B
insert into public.clients (id, firm_id, legal_name, trade_name, gstin, state_code, scheme, aato_band)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'Client 1 Firm A Retail', 'Client 1 Shop', '27AAAAA1111A1Z1', '27', 'regular', 'below_40l'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, 'Client 2 Firm B Stores', 'Client 2 Mart', '27BBBBB2222B1Z2', '27', 'regular', 'below_40l')
on conflict (id) do nothing;

-- Seed Client Invites for Firm A / Client A1:
-- 1. Pending (unaccepted) invite: 99999999-9999-9999-9999-999999999991
-- 2. Accepted invite:             99999999-9999-9999-9999-999999999992
insert into public.client_invites (id, firm_id, client_id, token_hash, expires_at, created_by, accepted_at, accepted_by)
values
  (
    '99999999-9999-9999-9999-999999999991'::uuid,
    '11111111-1111-1111-1111-111111111111'::uuid,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
    encode(digest('pending_invite_token_sample_1', 'sha256'), 'hex'),
    clock_timestamp() + interval '7 days',
    'a0000000-0000-0000-0000-000000000001'::uuid,
    null,
    null
  ),
  (
    '99999999-9999-9999-9999-999999999992'::uuid,
    '11111111-1111-1111-1111-111111111111'::uuid,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
    encode(digest('accepted_invite_token_sample_2', 'sha256'), 'hex'),
    clock_timestamp() + interval '7 days',
    'a0000000-0000-0000-0000-000000000001'::uuid,
    clock_timestamp(),
    'c0000000-0000-0000-0000-000000000001'::uuid
  )
on conflict (id) do nothing;

-- Initial Setup Verifications (Tests 1-6)
select results_eq(
  'select count(*)::integer from public.firms where id = ''11111111-1111-1111-1111-111111111111''',
  array[1],
  'Setup: Test Firm A successfully seeded'
);

select results_eq(
  'select count(*)::integer from public.firms where id = ''22222222-2222-2222-2222-222222222222''',
  array[1],
  'Setup: Test Firm B successfully seeded'
);

select results_eq(
  'select count(*)::integer from public.clients where id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''',
  array[1],
  'Setup: Client A1 seeded under Firm A'
);

select results_eq(
  'select count(*)::integer from public.clients where id = ''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb''',
  array[1],
  'Setup: Client B1 seeded under Firm B'
);

select results_eq(
  'select count(*)::integer from public.client_invites where id = ''99999999-9999-9999-9999-999999999991'' and accepted_at is null',
  array[1],
  'Setup: Pending invite seeded for Firm A'
);

select results_eq(
  'select count(*)::integer from public.client_invites where id = ''99999999-9999-9999-9999-999999999992'' and accepted_at is not null',
  array[1],
  'Setup: Accepted invite seeded for Firm A'
);

-- ============================================================================
-- 2. Test Case 1: Duplicate GSTIN Rejected Among Active Clients in Same Firm (Tests 7-8)
-- ============================================================================

-- Impersonate Firm A Admin
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "a0000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

-- Test 7: Duplicate GSTIN in same firm throws 23505 (unique violation) due to uq_clients_firm_gstin_active
select throws_ok(
  $$insert into public.clients (id, firm_id, legal_name, trade_name, gstin, state_code)
    values (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa02'::uuid,
      '11111111-1111-1111-1111-111111111111'::uuid,
      'Duplicate Retail Trader',
      'Duplicate Shop',
      '27AAAAA1111A1Z1',
      '27'
    )$$,
  '23505',
  null,
  'Duplicate active GSTIN in the same firm is rejected by uq_clients_firm_gstin_active partial unique index'
);

-- Impersonate Firm B Admin
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

-- Test 8: Same GSTIN can be registered under a different firm (Firm B) without collision
select lives_ok(
  $$insert into public.clients (id, firm_id, legal_name, trade_name, gstin, state_code)
    values (
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02'::uuid,
      '22222222-2222-2222-2222-222222222222'::uuid,
      'Different Firm Retail Trader',
      'Branch Store',
      '27AAAAA1111A1Z1',
      '27'
    )$$,
  'Same GSTIN can exist concurrently across distinct firms (tenancy-scoped index)'
);

-- ============================================================================
-- 3. Test Case 2: Archived GSTIN Reusable in Same Firm (Tests 9-12)
-- ============================================================================

-- Impersonate Firm A Admin
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "a0000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

-- Test 9: Seed a client to be archived in Firm A
select lives_ok(
  $$insert into public.clients (id, firm_id, legal_name, trade_name, gstin, state_code)
    values (
      'c1111111-0001-0000-0000-000000000001'::uuid,
      '11111111-1111-1111-1111-111111111111'::uuid,
      'Original Client To Archive',
      'Shop Old',
      '27REUSE1111A1Z9',
      '27'
    )$$,
  'Firm A admin inserts client destined for archive'
);

-- Test 10: Soft-delete / archive client 1
select results_eq(
  $$with archived as (
      update public.clients
      set deleted_at = clock_timestamp()
      where id = 'c1111111-0001-0000-0000-000000000001'::uuid
      returning 1
    ) select count(*)::integer from archived$$,
  array[1],
  'Firm A admin successfully soft-deletes (archives) client 1'
);

-- Test 11: Inserting client 2 in the same firm with the exact same GSTIN succeeds
select lives_ok(
  $$insert into public.clients (id, firm_id, legal_name, trade_name, gstin, state_code)
    values (
      'c1111111-0002-0000-0000-000000000001'::uuid,
      '11111111-1111-1111-1111-111111111111'::uuid,
      'Successor Client New',
      'Shop Reopened',
      '27REUSE1111A1Z9',
      '27'
    )$$,
  'Archived GSTIN is reusable: client 2 inserted with identical GSTIN in same firm'
);

-- Test 12: Verify both client records exist in Firm A (1 archived, 1 active)
select results_eq(
  $$select count(*)::integer from public.clients
    where firm_id = '11111111-1111-1111-1111-111111111111'
      and gstin = '27REUSE1111A1Z9'$$,
  array[2],
  'Both archived and active client records coexist with identical GSTIN'
);

-- ============================================================================
-- 4. Test Case 3: Staff Cannot Archive Clients (Tests 13-16)
-- ============================================================================

-- Impersonate Firm A Staff
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "a0000000-0000-0000-0000-000000000002", "role": "authenticated"}', true);
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

-- Test 13: Staff attempting to update deleted_at on an active client throws exception
select throws_ok(
  $$update public.clients
    set deleted_at = clock_timestamp()
    where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid$$,
  'P0001',
  'Only firm admins can archive or restore clients',
  'Staff cannot archive active client: trigger trg_check_client_archive_permission throws'
);

-- Test 14: Staff attempting to restore an archived client throws exception
select throws_ok(
  $$update public.clients
    set deleted_at = null
    where id = 'c1111111-0001-0000-0000-000000000001'::uuid$$,
  'P0001',
  'Only firm admins can archive or restore clients',
  'Staff cannot restore archived client: trigger trg_check_client_archive_permission throws'
);

-- Test 15: Staff CAN update general business fields (e.g. trade_name) without modifying deleted_at
select results_eq(
  $$with upd as (
      update public.clients
      set trade_name = 'Staff Updated Trade Name'
      where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
      returning 1
    ) select count(*)::integer from upd$$,
  array[1],
  'Staff can update non-lifecycle client metadata (trade_name) successfully'
);

-- Test 16: Verify deleted_at remains null for Client A1
select results_eq(
  $$select count(*)::integer from public.clients
    where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
      and deleted_at is null$$,
  array[1],
  'Client A1 remains active and unarchived after rejected staff archive attempt'
);

-- ============================================================================
-- 5. Test Case 4: Firm Admin Can Archive and Restore Clients (Tests 17-20)
-- ============================================================================

-- Impersonate Firm A Admin
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "a0000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

-- Test 17: Firm Admin can archive an active client
select lives_ok(
  $$update public.clients
    set deleted_at = clock_timestamp()
    where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid$$,
  'Firm admin successfully soft-deletes (archives) active client A1'
);

-- Test 18: Verify deleted_at is now set on Client A1
select results_eq(
  $$select count(*)::integer from public.clients
    where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
      and deleted_at is not null$$,
  array[1],
  'Client A1 reflects non-null deleted_at timestamp'
);

-- Test 19: Firm Admin can restore an archived client
select lives_ok(
  $$update public.clients
    set deleted_at = null
    where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid$$,
  'Firm admin successfully restores archived client A1'
);

-- Test 20: Verify deleted_at is now null on Client A1
select results_eq(
  $$select count(*)::integer from public.clients
    where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
      and deleted_at is null$$,
  array[1],
  'Client A1 is active again with deleted_at set to null'
);

-- ============================================================================
-- 6. Test Case 5: Cross-Firm Invite Revoke/Delete Is Impossible (Tests 21-24)
-- ============================================================================

-- Impersonate Firm B Admin
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

-- Test 21: Firm B Admin cannot delete Firm A's pending invite (RLS returns 0 rows)
select results_eq(
  $$with del as (
      delete from public.client_invites
      where id = '99999999-9999-9999-9999-999999999991'::uuid
      returning 1
    ) select count(*)::integer from del$$,
  array[0],
  'Firm B admin delete on Firm A invite affects 0 rows (denied by RLS)'
);

-- Test 22: Firm B Admin cannot revoke/update Firm A's pending invite (RLS returns 0 rows)
select results_eq(
  $$with upd as (
      update public.client_invites
      set deleted_at = clock_timestamp()
      where id = '99999999-9999-9999-9999-999999999991'::uuid
      returning 1
    ) select count(*)::integer from upd$$,
  array[0],
  'Firm B admin update/revoke on Firm A invite affects 0 rows (denied by RLS)'
);

-- Test 23: Firm B Admin cannot select Firm A's invites (RLS returns empty set)
select is_empty(
  $$select * from public.client_invites
    where id = '99999999-9999-9999-9999-999999999991'$$,
  'Firm B admin cannot view or select Firm A invites (empty set)'
);

-- ============================================================================
-- 7. Test Case 6: Accepted Invite Cannot Be Revoked or Deleted (Tests 24-28)
-- ============================================================================

-- Impersonate Firm A Admin
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "a0000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

-- Test 24: Verify Firm A pending invite is untouched and active (visible to Firm A Admin)
select results_eq(
  $$select count(*)::integer from public.client_invites
    where id = '99999999-9999-9999-9999-999999999991'
      and deleted_at is null
      and accepted_at is null$$,
  array[1],
  'Firm A pending invite remains unrevoked and intact after Firm B attempts'
);

-- Test 25: Firm A Admin cannot delete an accepted invite (accepted_at is not null)
select results_eq(
  $$with del as (
      delete from public.client_invites
      where id = '99999999-9999-9999-9999-999999999992'::uuid
      returning 1
    ) select count(*)::integer from del$$,
  array[0],
  'Firm A admin delete on accepted invite affects 0 rows (denied by RLS accepted_at is null check)'
);

-- Test 26: Firm A Admin cannot update or revoke an accepted invite (accepted_at is not null)
select results_eq(
  $$with upd as (
      update public.client_invites
      set deleted_at = clock_timestamp()
      where id = '99999999-9999-9999-9999-999999999992'::uuid
      returning 1
    ) select count(*)::integer from upd$$,
  array[0],
  'Firm A admin update/revoke on accepted invite affects 0 rows (denied by RLS accepted_at is null check)'
);

-- Test 27: Firm A Admin CAN delete a pending (unaccepted) invite
select results_eq(
  $$with del as (
      delete from public.client_invites
      where id = '99999999-9999-9999-9999-999999999991'::uuid
      returning 1
    ) select count(*)::integer from del$$,
  array[1],
  'Firm A admin can delete a pending unaccepted invite (1 row affected)'
);

-- Test 28: Verify accepted invite remains intact in the database as audit record
select results_eq(
  $$select count(*)::integer from public.client_invites
    where id = '99999999-9999-9999-9999-999999999992'
      and accepted_at is not null
      and deleted_at is null$$,
  array[1],
  'Accepted invite remains permanently recorded in public.client_invites'
);

-- ============================================================================
-- 8. Boundary Isolation: Outsider and Anon Negative Assertions (Tests 29-30)
-- ============================================================================

-- Impersonate Outsider
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "e0000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
select set_config('request.jwt.claim.sub', 'e0000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

-- Test 29: Outsider cannot archive any client
select results_eq(
  $$with upd as (
      update public.clients
      set deleted_at = clock_timestamp()
      where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
      returning 1
    ) select count(*)::integer from upd$$,
  array[0],
  'Outsider cannot archive client (0 rows affected by RLS)'
);

-- Impersonate Anonymous
set local role anon;
select set_config('request.jwt.claims', '', true);
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);

-- Test 30: Anonymous user cannot delete or archive clients
select results_eq(
  $$with del as (
      delete from public.clients
      where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
      returning 1
    ) select count(*)::integer from del$$,
  array[0],
  'Anonymous user cannot delete client (0 rows affected by RLS)'
);

-- ============================================================================
-- 9. Finish Test Suite & Rollback
-- ============================================================================

reset role;

select * from finish();

rollback;
