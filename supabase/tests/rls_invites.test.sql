-- pgTAP Test Suite: RLS & Helper Functions for Client Invites
-- Verifies:
-- 1. Atomic firm creation with admin role via create_firm_with_admin
-- 2. Client invite token generation, secure hashing, and non-retrievability of raw token
-- 3. Cross-firm creation denial
-- 4. Invite preview with peek_client_invite
-- 5. Expiration and invalidity handling in peek_client_invite
-- 6. Invite acceptance, client_access assignment with owner role, and accepted timestamp
-- 7. Single-use enforcement (reusing accepted token rejected)
-- 8. Expired token rejection on accept
-- 9. Table-level RLS on client_invites: owners and outsiders cannot select directly
-- 10. Multi-firm tenant isolation for firm admins on client_invites

begin;

-- Initialize pgTAP plan (54 tests)
select plan(54);

-- ============================================================================
-- 0. Environment Setup & Grants
-- ============================================================================

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;

-- ============================================================================
-- 1. Test Fixtures Setup (Run as Superuser / postgres)
-- ============================================================================

-- Test Users:
-- Firm A Admin:            a0000000-0000-0000-0000-000000000001
-- Firm A Staff:            a0000000-0000-0000-0000-000000000002
-- Firm B Admin:            b0000000-0000-0000-0000-000000000001
-- Client Owner Candidate:  c0000000-0000-0000-0000-000000000002
-- Outsider:                e0000000-0000-0000-0000-000000000001
-- New Firm Admin Cand:     f0000000-0000-0000-0000-000000000001

insert into auth.users (id, aud, role, email)
values
  ('a0000000-0000-0000-0000-000000000001'::uuid, 'authenticated', 'authenticated', 'firm_a_admin@test.local'),
  ('a0000000-0000-0000-0000-000000000002'::uuid, 'authenticated', 'authenticated', 'firm_a_staff@test.local'),
  ('b0000000-0000-0000-0000-000000000001'::uuid, 'authenticated', 'authenticated', 'firm_b_admin@test.local'),
  ('c0000000-0000-0000-0000-000000000002'::uuid, 'authenticated', 'authenticated', 'client_candidate@test.local'),
  ('e0000000-0000-0000-0000-000000000001'::uuid, 'authenticated', 'authenticated', 'outsider@test.local'),
  ('f0000000-0000-0000-0000-000000000001'::uuid, 'authenticated', 'authenticated', 'new_firm_admin@test.local')
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

-- Clients: Client A1 under Firm A, Client B1 under Firm B
insert into public.clients (id, firm_id, legal_name, trade_name, gstin, state_code, scheme, aato_band)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'Client 1 Firm A Retail', 'Client 1 Shop', '27AAAAA1111A1Z1', '27', 'regular', 'below_40l'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, 'Client 2 Firm B Stores', 'Client 2 Mart', '27BBBBB2222B1Z2', '27', 'regular', 'below_40l')
on conflict (id) do nothing;

-- Seed an expired invite for Firm A / Client A1 to test expiration behaviors
insert into public.client_invites (id, firm_id, client_id, token_hash, expires_at, created_by)
values (
  '99999999-9999-9999-9999-999999999991'::uuid,
  '11111111-1111-1111-1111-111111111111'::uuid,
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
  encode(digest('expired_test_raw_token_xyz', 'sha256'), 'hex'),
  clock_timestamp() - interval '1 hour',
  'a0000000-0000-0000-0000-000000000001'::uuid
)
on conflict (id) do nothing;

-- Initial Setup Verifications (Tests 1-4)
select results_eq(
  'select count(*)::integer from public.firms where id = ''11111111-1111-1111-1111-111111111111''',
  array[1],
  'Setup: Test Firm A seeded'
);

select results_eq(
  'select count(*)::integer from public.firms where id = ''22222222-2222-2222-2222-222222222222''',
  array[1],
  'Setup: Test Firm B seeded'
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

-- ============================================================================
-- 2. create_firm_with_admin Assertions (Tests 5-9)
-- ============================================================================

-- Test 5: Anon cannot call create_firm_with_admin
set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);

select throws_ok(
  'select public.create_firm_with_admin(''Anon Accounting Practice'')',
  'P0001',
  'Not authenticated',
  'create_firm_with_admin throws Not authenticated for anon user'
);

-- Impersonate New Firm Admin Candidate
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "f0000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

-- Test 6: create_firm_with_admin creates firm and returns valid UUID
create temporary table test_new_firm as
select public.create_firm_with_admin('Sharma & Associates') as firm_id;
grant select on test_new_firm to anon, authenticated;

select ok(
  (select firm_id from test_new_firm) is not null,
  'create_firm_with_admin returns a valid firm_id UUID'
);

-- Test 7: Firm record exists in public.firms with created_by set to auth.uid()
select results_eq(
  'select name from public.firms where id = (select firm_id from test_new_firm)',
  array['Sharma & Associates'::text],
  'create_firm_with_admin created the firm record with expected name'
);

-- Test 8: Creator is assigned admin role in public.firm_members
select results_eq(
  'select role from public.firm_members where firm_id = (select firm_id from test_new_firm) and user_id = ''f0000000-0000-0000-0000-000000000001''',
  array['admin'::public.firm_role],
  'create_firm_with_admin atomically assigns creator as admin in firm_members'
);

-- Test 9: Firm member count for newly created firm is exactly 1
select results_eq(
  'select count(*)::integer from public.firm_members where firm_id = (select firm_id from test_new_firm)',
  array[1],
  'create_firm_with_admin provisions exactly 1 admin member'
);

-- ============================================================================
-- 3. create_client_invite & Secure Token Hashing (Tests 10-16)
-- ============================================================================

-- Impersonate Firm A Admin
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "a0000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

-- Test 10: Firm A Admin creates client invite for Client A1
create temporary table test_invite_1 as
select public.create_client_invite('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid) as token;
grant select on test_invite_1 to anon, authenticated;

select ok(
  (select token from test_invite_1) is not null,
  'create_client_invite successfully returns a raw token string'
);

-- Test 11: Raw token length is 64 hex characters (32 bytes)
select results_eq(
  'select length(token)::integer from test_invite_1',
  array[64],
  'create_client_invite generates 64-hex-character raw token'
);

-- Test 12: Raw token is NOT stored in client_invites (raw token != token_hash)
select results_eq(
  'select count(*)::integer from public.client_invites ci join test_invite_1 t on ci.client_id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'' where ci.token_hash != t.token',
  array[2], -- 1 newly created + 1 expired seeded
  'Raw invite token is not stored in plaintext in client_invites'
);

-- Test 13: Stored token_hash matches SHA-256 digest of raw token
select results_eq(
  'select count(*)::integer from public.client_invites ci join test_invite_1 t on ci.token_hash = encode(digest(t.token, ''sha256''), ''hex'')',
  array[1],
  'Stored token_hash matches SHA-256 digest of raw token'
);

-- Test 14: Invite expires_at is set in the future
select results_eq(
  'select (ci.expires_at > clock_timestamp()) from public.client_invites ci join test_invite_1 t on ci.token_hash = encode(digest(t.token, ''sha256''), ''hex'')',
  array[true],
  'Invite expires_at is correctly set in the future'
);

-- Test 15: Invite accepted_at is initially null
select results_eq(
  'select (ci.accepted_at is null) from public.client_invites ci join test_invite_1 t on ci.token_hash = encode(digest(t.token, ''sha256''), ''hex'')',
  array[true],
  'New invite accepted_at is null upon creation'
);

-- Test 16: Invite created_by is set to Firm A Admin
select results_eq(
  'select ci.created_by from public.client_invites ci join test_invite_1 t on ci.token_hash = encode(digest(t.token, ''sha256''), ''hex'')',
  array['a0000000-0000-0000-0000-000000000001'::uuid],
  'Invite created_by tracks the creating admin ID'
);

-- ============================================================================
-- 4. Cross-Firm & Privilege Restrictions on create_client_invite (Tests 17-20)
-- ============================================================================

-- Test 17: Firm A Admin CANNOT create invite for Client B1 belonging to Firm B
select throws_ok(
  'select public.create_client_invite(''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb''::uuid)',
  'P0001',
  'Permission denied',
  'Firm A admin cannot create invite for another firm''s client (throws Permission denied)'
);

-- Test 18: Firm A Staff CANNOT create client invite
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "a0000000-0000-0000-0000-000000000002", "role": "authenticated"}', true);
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select throws_ok(
  'select public.create_client_invite(''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''::uuid)',
  'P0001',
  'Permission denied',
  'Firm staff cannot create client invite (throws Permission denied)'
);

-- Test 19: Outsider CANNOT create client invite
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "e0000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
select set_config('request.jwt.claim.sub', 'e0000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select throws_ok(
  'select public.create_client_invite(''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''::uuid)',
  'P0001',
  'Permission denied',
  'Outsider cannot create client invite (throws Permission denied)'
);

-- Test 20: Non-existent client throws 'Client not found'
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "a0000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select throws_ok(
  'select public.create_client_invite(''00000000-0000-0000-0000-000000000000''::uuid)',
  'P0001',
  'Client not found',
  'create_client_invite throws Client not found for nonexistent client ID'
);

-- ============================================================================
-- 5. peek_client_invite Assertions (Tests 21-27)
-- ============================================================================

-- Call peek_client_invite as anonymous recipient
set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);

-- Test 21: peek_client_invite returns correct client_name
select results_eq(
  'select (public.peek_client_invite(token)->>''client_name'') from test_invite_1',
  array['Client 1 Shop'::text],
  'peek_client_invite returns correct client_name for valid token'
);

-- Test 22: peek_client_invite returns correct firm_name
select results_eq(
  'select (public.peek_client_invite(token)->>''firm_name'') from test_invite_1',
  array['Test CA Firm A'::text],
  'peek_client_invite returns correct firm_name for valid token'
);

-- Test 23: peek_client_invite returns correct client_id
select results_eq(
  'select (public.peek_client_invite(token)->>''client_id'')::uuid from test_invite_1',
  array['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid],
  'peek_client_invite returns correct client_id for valid token'
);

-- Test 24: peek_client_invite returns correct firm_id
select results_eq(
  'select (public.peek_client_invite(token)->>''firm_id'')::uuid from test_invite_1',
  array['11111111-1111-1111-1111-111111111111'::uuid],
  'peek_client_invite returns correct firm_id for valid token'
);

-- Test 25: peek_client_invite returns null for invalid token
select is(
  public.peek_client_invite('nonexistent_token_1234567890'),
  null::jsonb,
  'peek_client_invite returns null for invalid token'
);

-- Test 26: peek_client_invite returns null for null input
select is(
  public.peek_client_invite(null),
  null::jsonb,
  'peek_client_invite returns null for null input'
);

-- Test 27: peek_client_invite returns null for expired token
select is(
  public.peek_client_invite('expired_test_raw_token_xyz'),
  null::jsonb,
  'peek_client_invite returns null for expired token'
);

-- ============================================================================
-- 6. accept_client_invite Assertions (Tests 28-32)
-- ============================================================================

-- Impersonate Client Owner Candidate
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "c0000000-0000-0000-0000-000000000002", "role": "authenticated"}', true);
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

-- Test 28: accept_client_invite returns client_id on success
select results_eq(
  'select public.accept_client_invite(token) from test_invite_1',
  array['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid],
  'accept_client_invite returns the claimed client_id'
);

-- Test 29: Inserts client_access with role 'owner' for auth.uid()
select results_eq(
  'select role from public.client_access where client_id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'' and user_id = ''c0000000-0000-0000-0000-000000000002''',
  array['owner'::public.client_role],
  'accept_client_invite assigns client_access role owner to auth.uid()'
);

-- Test 30: client_access associates client with correct managing firm_id
select results_eq(
  'select firm_id from public.client_access where client_id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'' and user_id = ''c0000000-0000-0000-0000-000000000002''',
  array['11111111-1111-1111-1111-111111111111'::uuid],
  'accept_client_invite correctly sets managing firm_id in client_access'
);

-- Reset role to verify client_invites table state (table RLS forbids owner select)
reset role;

-- Test 31: Invite is marked as accepted (accepted_at is not null)
select results_eq(
  'select (ci.accepted_at is not null) from public.client_invites ci join test_invite_1 t on ci.token_hash = encode(digest(t.token, ''sha256''), ''hex'')',
  array[true],
  'Invite accepted_at is populated after acceptance'
);

-- Test 32: Invite accepted_by is recorded as auth.uid()
select results_eq(
  'select ci.accepted_by from public.client_invites ci join test_invite_1 t on ci.token_hash = encode(digest(t.token, ''sha256''), ''hex'')',
  array['c0000000-0000-0000-0000-000000000002'::uuid],
  'Invite accepted_by is set to the accepting user ID'
);

-- ============================================================================
-- 7. Single-Use & Expiration Rejections in accept_client_invite (Tests 33-37)
-- ============================================================================

-- Re-impersonate Client Owner Candidate
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "c0000000-0000-0000-0000-000000000002", "role": "authenticated"}', true);
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

-- Test 33: Reusing an already accepted token is rejected
select throws_ok(
  'select public.accept_client_invite(token) from test_invite_1',
  'P0001',
  'Invalid or expired invite token',
  'Reusing an accepted token is rejected by accept_client_invite'
);

-- Test 34: peek_client_invite returns null on accepted token
select is(
  public.peek_client_invite((select token from test_invite_1)),
  null::jsonb,
  'peek_client_invite returns null for already accepted token'
);

-- Test 35: Expired token is rejected by accept_client_invite
select throws_ok(
  'select public.accept_client_invite(''expired_test_raw_token_xyz'')',
  'P0001',
  'Invalid or expired invite token',
  'Expired token is rejected by accept_client_invite'
);

-- Test 36: Nonexistent token is rejected by accept_client_invite
select throws_ok(
  'select public.accept_client_invite(''bogus_token_never_generated'')',
  'P0001',
  'Invalid or expired invite token',
  'Nonexistent token is rejected by accept_client_invite'
);

-- Test 37: Unauthenticated call to accept_client_invite throws Not authenticated
set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);

select throws_ok(
  'select public.accept_client_invite(''any_token'')',
  'P0001',
  'Not authenticated',
  'accept_client_invite throws Not authenticated for anon user'
);

-- ============================================================================
-- 8. Table-Level RLS: Direct Access Prohibited for Non-Admins (Tests 38-46)
-- ============================================================================

-- Impersonate Client Owner (now owner of Client A1)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "c0000000-0000-0000-0000-000000000002", "role": "authenticated"}', true);
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

-- Test 38: Client Owner cannot select from client_invites (returns empty set)
select is_empty(
  'select * from public.client_invites',
  'Client Owner cannot select client_invites table directly (returns empty set)'
);

-- Test 39: Client Owner count of client_invites returns 0 rows
select results_eq(
  'select count(*)::integer from public.client_invites',
  array[0],
  'Client Owner count of client_invites returns 0'
);

-- Test 40: Client Owner cannot insert directly into client_invites
select throws_ok(
  'insert into public.client_invites (firm_id, client_id, token_hash)
   values (''11111111-1111-1111-1111-111111111111''::uuid, ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''::uuid, ''owner_hack_hash'')',
  '42501',
  null,
  'Client Owner cannot insert directly into client_invites (throws 42501)'
);

-- Test 41: Client Owner cannot update client_invites directly
select results_eq(
  'update public.client_invites set token_hash = ''owner_mod'' returning id',
  '{}'::uuid[],
  'Client Owner cannot update client_invites directly (returns 0 rows)'
);

-- Test 42: Client Owner cannot delete from client_invites directly
select results_eq(
  'delete from public.client_invites returning id',
  '{}'::uuid[],
  'Client Owner cannot delete from client_invites directly (returns 0 rows)'
);

-- Impersonate Outsider
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "e0000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
select set_config('request.jwt.claim.sub', 'e0000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

-- Test 43: Outsider cannot select from client_invites
select is_empty(
  'select * from public.client_invites',
  'Outsider cannot select client_invites table directly (returns empty set)'
);

-- Test 44: Outsider count returns 0
select results_eq(
  'select count(*)::integer from public.client_invites',
  array[0],
  'Outsider count of client_invites returns 0'
);

-- Impersonate Firm A Staff (Staff is not Firm Admin)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "a0000000-0000-0000-0000-000000000002", "role": "authenticated"}', true);
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

-- Test 45: Firm Staff cannot select client_invites
select is_empty(
  'select * from public.client_invites',
  'Firm Staff cannot select client_invites directly (returns empty set)'
);

-- Test 46: Firm Staff count returns 0
select results_eq(
  'select count(*)::integer from public.client_invites',
  array[0],
  'Firm Staff count of client_invites returns 0'
);

-- ============================================================================
-- 9. Firm Admin Isolation & Management on client_invites (Tests 47-54)
-- ============================================================================

-- Impersonate Firm B Admin
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

-- Test 47: Firm B Admin can create invite for Client B1
create temporary table test_invite_b as
select public.create_client_invite('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid) as token;
grant select on test_invite_b to anon, authenticated;

select ok(
  (select token from test_invite_b) is not null,
  'Firm B Admin can create client invite for Client B1'
);

-- Test 48: Firm B Admin selects only Firm B invites
select results_eq(
  'select count(*)::integer from public.client_invites where firm_id = ''22222222-2222-2222-2222-222222222222''',
  array[1],
  'Firm B Admin can select their firm''s invites'
);

-- Test 49: Firm B Admin CANNOT see Firm A invites
select is_empty(
  'select * from public.client_invites where firm_id = ''11111111-1111-1111-1111-111111111111''',
  'Firm B Admin CANNOT select Firm A invites (empty set)'
);

-- Test 50: Firm B Admin CANNOT delete Firm A invites
select results_eq(
  'delete from public.client_invites where firm_id = ''11111111-1111-1111-1111-111111111111'' returning id',
  '{}'::uuid[],
  'Firm B Admin CANNOT delete Firm A invites'
);

-- Impersonate Firm A Admin
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "a0000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

-- Test 51: Firm A Admin can select their firm's invites (accepted invite + expired invite)
select results_eq(
  'select count(*)::integer from public.client_invites where firm_id = ''11111111-1111-1111-1111-111111111111''',
  array[2],
  'Firm A Admin can select their firm''s invites'
);

-- Test 52: Firm A Admin CANNOT see Firm B invites
select is_empty(
  'select * from public.client_invites where firm_id = ''22222222-2222-2222-2222-222222222222''',
  'Firm A Admin CANNOT select Firm B invites (empty set)'
);

-- Test 53: Firm A Admin CANNOT delete Firm B invites
select results_eq(
  'delete from public.client_invites where firm_id = ''22222222-2222-2222-2222-222222222222'' returning id',
  '{}'::uuid[],
  'Firm A Admin CANNOT delete Firm B invites'
);

-- Test 54: Firm A Admin CAN delete their own firm's invite
select results_eq(
  'delete from public.client_invites where id = ''99999999-9999-9999-9999-999999999991''::uuid returning id',
  array['99999999-9999-9999-9999-999999999991'::uuid],
  'Firm A Admin CAN delete their own firm''s invite'
);

-- ============================================================================
-- 10. Finish & Teardown
-- ============================================================================

reset role;
select * from finish();
rollback;
