-- pgTAP Test Suite: RLS Tenancy, Documents, Purchases
-- Verifies row-level security isolation across accounting firms and SME clients.

begin;

-- Initialize pgTAP plan
select plan(50);

-- ============================================================================
-- 0. Environment Setup & Grants
-- ============================================================================

-- Grant schema and table access so RLS policies are the sole access filter
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;

-- ============================================================================
-- 1. Test Fixtures Setup (Run as Superuser / postgres)
-- ============================================================================

-- Test Users
-- Firm A Admin:    a0000000-0000-0000-0000-000000000001
-- Firm A Staff:    a0000000-0000-0000-0000-000000000002
-- Firm B Admin:    b0000000-0000-0000-0000-000000000001
-- Firm B Staff:    b0000000-0000-0000-0000-000000000002
-- Client Owner A:  c0000000-0000-0000-0000-000000000001
-- Outsider:        e0000000-0000-0000-0000-000000000001

insert into auth.users (id, aud, role, email)
values
  ('a0000000-0000-0000-0000-000000000001'::uuid, 'authenticated', 'authenticated', 'firm_a_admin@test.local'),
  ('a0000000-0000-0000-0000-000000000002'::uuid, 'authenticated', 'authenticated', 'firm_a_staff@test.local'),
  ('b0000000-0000-0000-0000-000000000001'::uuid, 'authenticated', 'authenticated', 'firm_b_admin@test.local'),
  ('b0000000-0000-0000-0000-000000000002'::uuid, 'authenticated', 'authenticated', 'firm_b_staff@test.local'),
  ('c0000000-0000-0000-0000-000000000001'::uuid, 'authenticated', 'authenticated', 'client_owner_a@test.local'),
  ('e0000000-0000-0000-0000-000000000001'::uuid, 'authenticated', 'authenticated', 'outsider@test.local')
on conflict (id) do nothing;

-- Test Firms: Firm A & Firm B
insert into public.firms (id, name, created_by)
values
  ('11111111-1111-1111-1111-111111111111'::uuid, 'Test CA Firm A', 'a0000000-0000-0000-0000-000000000001'::uuid),
  ('22222222-2222-2222-2222-222222222222'::uuid, 'Test CA Firm B', 'b0000000-0000-0000-0000-000000000001'::uuid)
on conflict (id) do nothing;

-- Firm Members: Firm A (Admin, Staff), Firm B (Admin, Staff)
insert into public.firm_members (firm_id, user_id, role)
values
  ('11111111-1111-1111-1111-111111111111'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, 'admin'),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'a0000000-0000-0000-0000-000000000002'::uuid, 'staff'),
  ('22222222-2222-2222-2222-222222222222'::uuid, 'b0000000-0000-0000-0000-000000000001'::uuid, 'admin'),
  ('22222222-2222-2222-2222-222222222222'::uuid, 'b0000000-0000-0000-0000-000000000002'::uuid, 'staff')
on conflict (firm_id, user_id) do nothing;

-- Clients: Client 1 under Firm A, Client 2 under Firm B
insert into public.clients (id, firm_id, legal_name, trade_name, gstin, state_code, scheme, aato_band)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'Client 1 Firm A Retail', 'Client 1 Shop', '27AAAAA1111A1Z1', '27', 'regular', 'below_40l'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, 'Client 2 Firm B Stores', 'Client 2 Mart', '27BBBBB2222B1Z2', '27', 'regular', 'below_40l')
on conflict (id) do nothing;

-- Client Access: Client Owner A owns Client 1
insert into public.client_access (firm_id, client_id, user_id, role)
values
  ('11111111-1111-1111-1111-111111111111'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'c0000000-0000-0000-0000-000000000001'::uuid, 'owner')
on conflict (client_id, user_id) do nothing;

-- Documents: Doc 1 under Firm A / Client 1, Doc 2 under Firm B / Client 2
insert into public.documents (id, firm_id, client_id, kind, storage_path, original_name, mime_type, size_bytes, sha256, status, uploaded_by, period_fp)
values
  ('d1111111-1111-1111-1111-111111111111'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'purchase_bill', 'firms/11111111-1111-1111-1111-111111111111/client1/bill1.pdf', 'purchase_bill_001.pdf', 'application/pdf', 1024, '1111111111111111111111111111111111111111111111111111111111111111', 'uploaded', 'a0000000-0000-0000-0000-000000000002'::uuid, '102026'),
  ('d2222222-2222-2222-2222-222222222222'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, 'purchase_bill', 'firms/22222222-2222-2222-2222-222222222222/client2/bill2.pdf', 'purchase_bill_002.pdf', 'application/pdf', 2048, '2222222222222222222222222222222222222222222222222222222222222222', 'uploaded', 'b0000000-0000-0000-0000-000000000002'::uuid, '102026')
on conflict (id) do nothing;

-- Suppliers: Supplier 1 under Firm A / Client 1, Supplier 2 under Firm B / Client 2
insert into public.suppliers (id, firm_id, client_id, gstin, name, filing_status)
values
  ('31111111-1111-1111-1111-111111111111'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '27SUPPA1111A1Z1', 'Supplier Alpha (Firm A)', 'filed'),
  ('32222222-2222-2222-2222-222222222222'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, '27SUPPB2222B1Z2', 'Supplier Beta (Firm B)', 'filed')
on conflict (id) do nothing;

-- Invoices: Invoice 1 under Firm A / Client 1, Invoice 2 under Firm B / Client 2
insert into public.invoices (id, firm_id, client_id, supplier_id, document_id, invoice_no, invoice_no_norm, invoice_date, place_of_supply, taxable_value, cgst, sgst, igst, total, status, source, itc_state, period_fp)
values
  ('41111111-1111-1111-1111-111111111111'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '31111111-1111-1111-1111-111111111111'::uuid, 'd1111111-1111-1111-1111-111111111111'::uuid, 'INV/A/001', 'INVA001', '2026-10-01', '27', 10000.00, 900.00, 900.00, 0.00, 11800.00, 'approved', 'extracted', 'eligible', '102026'),
  ('42222222-2222-2222-2222-222222222222'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, '32222222-2222-2222-2222-222222222222'::uuid, 'd2222222-2222-2222-2222-222222222222'::uuid, 'INV/B/001', 'INVB001', '2026-10-01', '27', 20000.00, 1800.00, 1800.00, 0.00, 23600.00, 'approved', 'extracted', 'eligible', '102026')
on conflict (id) do nothing;

-- Initial Setup Verifications (Tests 1-4)
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
  'Setup: Client 1 under Firm A successfully seeded'
);

select results_eq(
  'select count(*)::integer from public.clients where id = ''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb''',
  array[1],
  'Setup: Client 2 under Firm B successfully seeded'
);

-- ============================================================================
-- 2. Firm A Staff Assertions (Tests 5-17)
-- ============================================================================

-- Impersonate Firm A Staff
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "a0000000-0000-0000-0000-000000000002"}', true);
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

-- Assertion: Firm A staff can select Firm A clients and documents
select results_eq(
  'select id from public.clients where firm_id = ''11111111-1111-1111-1111-111111111111''',
  array['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid],
  'Firm A staff can select Firm A clients'
);

select results_eq(
  'select count(*)::integer from public.clients where firm_id = ''11111111-1111-1111-1111-111111111111''',
  array[1],
  'Firm A staff sees exactly 1 client for Firm A'
);

select results_eq(
  'select id from public.documents where firm_id = ''11111111-1111-1111-1111-111111111111''',
  array['d1111111-1111-1111-1111-111111111111'::uuid],
  'Firm A staff can select Firm A documents'
);

select results_eq(
  'select count(*)::integer from public.documents where firm_id = ''11111111-1111-1111-1111-111111111111''',
  array[1],
  'Firm A staff sees exactly 1 document for Firm A'
);

select results_eq(
  'select count(*)::integer from public.suppliers where firm_id = ''11111111-1111-1111-1111-111111111111''',
  array[1],
  'Firm A staff can select Firm A suppliers'
);

select results_eq(
  'select count(*)::integer from public.invoices where firm_id = ''11111111-1111-1111-1111-111111111111''',
  array[1],
  'Firm A staff can select Firm A invoices'
);

-- Assertion: Firm A staff CANNOT select Firm B clients, documents, or suppliers (returns 0 rows)
select is_empty(
  'select * from public.clients where firm_id = ''22222222-2222-2222-2222-222222222222''',
  'Firm A staff CANNOT select Firm B clients (empty set)'
);

select results_eq(
  'select count(*)::integer from public.clients where firm_id = ''22222222-2222-2222-2222-222222222222''',
  array[0],
  'Firm A staff count of Firm B clients returns 0 rows'
);

select is_empty(
  'select * from public.documents where firm_id = ''22222222-2222-2222-2222-222222222222''',
  'Firm A staff CANNOT select Firm B documents (empty set)'
);

select results_eq(
  'select count(*)::integer from public.documents where firm_id = ''22222222-2222-2222-2222-222222222222''',
  array[0],
  'Firm A staff count of Firm B documents returns 0 rows'
);

select is_empty(
  'select * from public.suppliers where firm_id = ''22222222-2222-2222-2222-222222222222''',
  'Firm A staff CANNOT select Firm B suppliers (empty set)'
);

select results_eq(
  'select count(*)::integer from public.suppliers where firm_id = ''22222222-2222-2222-2222-222222222222''',
  array[0],
  'Firm A staff count of Firm B suppliers returns 0 rows'
);

select is_empty(
  'select * from public.invoices where firm_id = ''22222222-2222-2222-2222-222222222222''',
  'Firm A staff CANNOT select Firm B invoices (empty set)'
);

-- ============================================================================
-- 3. Firm B Staff Assertions (Tests 18-23)
-- ============================================================================

-- Impersonate Firm B Staff
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000002"}', true);
select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

-- Assertion: Firm B staff CANNOT select Firm A clients or invoices
select is_empty(
  'select * from public.clients where firm_id = ''11111111-1111-1111-1111-111111111111''',
  'Firm B staff CANNOT select Firm A clients (empty set)'
);

select results_eq(
  'select count(*)::integer from public.clients where firm_id = ''11111111-1111-1111-1111-111111111111''',
  array[0],
  'Firm B staff count of Firm A clients returns 0 rows'
);

select is_empty(
  'select * from public.invoices where firm_id = ''11111111-1111-1111-1111-111111111111''',
  'Firm B staff CANNOT select Firm A invoices (empty set)'
);

select results_eq(
  'select count(*)::integer from public.invoices where firm_id = ''11111111-1111-1111-1111-111111111111''',
  array[0],
  'Firm B staff count of Firm A invoices returns 0 rows'
);

-- Positive assertion: Firm B staff can select their own firm's data
select results_eq(
  'select id from public.clients where firm_id = ''22222222-2222-2222-2222-222222222222''',
  array['bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid],
  'Firm B staff can select Firm B clients'
);

select results_eq(
  'select id from public.invoices where firm_id = ''22222222-2222-2222-2222-222222222222''',
  array['42222222-2222-2222-2222-222222222222'::uuid],
  'Firm B staff can select Firm B invoices'
);

-- ============================================================================
-- 4. Client Owner A Assertions (Tests 24-36)
-- ============================================================================

-- Impersonate Client Owner A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "c0000000-0000-0000-0000-000000000001"}', true);
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

-- Assertion: Client Owner A can select their own client, documents (purchase_bill), and invoices
select results_eq(
  'select id from public.clients where id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''',
  array['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid],
  'Client Owner A can select their own client'
);

select results_eq(
  'select id from public.documents where client_id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''',
  array['d1111111-1111-1111-1111-111111111111'::uuid],
  'Client Owner A can select their own documents (purchase_bill)'
);

select results_eq(
  'select id from public.invoices where client_id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''',
  array['41111111-1111-1111-1111-111111111111'::uuid],
  'Client Owner A can select their own invoices'
);

select results_eq(
  'select id from public.suppliers where client_id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''',
  array['31111111-1111-1111-1111-111111111111'::uuid],
  'Client Owner A can select their own suppliers'
);

-- Assertion: Client Owner A CANNOT select Firm B documents or other clients
select is_empty(
  'select * from public.documents where client_id = ''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb''',
  'Client Owner A CANNOT select Firm B documents (returns 0 rows)'
);

select is_empty(
  'select * from public.clients where id = ''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb''',
  'Client Owner A CANNOT select other clients (returns 0 rows)'
);

select results_eq(
  'select count(*)::integer from public.clients',
  array[1],
  'Client Owner A total visible clients across all firms is exactly 1'
);

select results_eq(
  'select count(*)::integer from public.documents',
  array[1],
  'Client Owner A total visible documents across all firms is exactly 1'
);

select results_eq(
  'select count(*)::integer from public.invoices',
  array[1],
  'Client Owner A total visible invoices across all firms is exactly 1'
);

-- Assertion: Client Owner A CANNOT update firm_members or escalate role
select is_empty(
  'select * from public.firm_members',
  'Client Owner A cannot select or inspect firm_members roster'
);

select results_eq(
  'with updated as (
     update public.firm_members
     set role = ''admin''
     where user_id = ''a0000000-0000-0000-0000-000000000002''
     returning 1
   )
   select count(*)::integer from updated',
  array[0],
  'Client Owner A update on firm_members affects 0 rows (permission denied by RLS)'
);

select throws_ok(
  'insert into public.firm_members (firm_id, user_id, role) values (''11111111-1111-1111-1111-111111111111'', ''c0000000-0000-0000-0000-000000000001'', ''admin'')',
  '42501'::character(5),
  null::text,
  'Client Owner A cannot insert into firm_members to escalate role'
);

select throws_ok(
  'insert into public.client_access (firm_id, client_id, user_id, role) values (''22222222-2222-2222-2222-222222222222'', ''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'', ''c0000000-0000-0000-0000-000000000001'', ''owner'')',
  '42501'::character(5),
  null::text,
  'Client Owner A cannot grant self access to another firm''s client'
);

-- ============================================================================
-- 5. Outsider Assertions (Tests 37-43)
-- Authenticated user with no firm membership and no client grants
-- ============================================================================

-- Impersonate Outsider
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "e0000000-0000-0000-0000-000000000001"}', true);
select set_config('request.jwt.claim.sub', 'e0000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select results_eq(
  'select count(*)::integer from public.firms',
  array[0],
  'Outsider returns 0 rows for firms'
);

select results_eq(
  'select count(*)::integer from public.firm_members',
  array[0],
  'Outsider returns 0 rows for firm_members'
);

select results_eq(
  'select count(*)::integer from public.clients',
  array[0],
  'Outsider returns 0 rows for clients'
);

select results_eq(
  'select count(*)::integer from public.client_access',
  array[0],
  'Outsider returns 0 rows for client_access'
);

select results_eq(
  'select count(*)::integer from public.documents',
  array[0],
  'Outsider returns 0 rows for documents'
);

select results_eq(
  'select count(*)::integer from public.suppliers',
  array[0],
  'Outsider returns 0 rows for suppliers'
);

select results_eq(
  'select count(*)::integer from public.invoices',
  array[0],
  'Outsider returns 0 rows for invoices'
);

-- ============================================================================
-- 6. Unauthenticated / Anonymous Access Assertions (Tests 44-50)
-- Anonymous session without JWT sub claims
-- ============================================================================

-- Impersonate Anon
set local role anon;
select set_config('request.jwt.claims', '', true);
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);

select results_eq(
  'select count(*)::integer from public.firms',
  array[0],
  'Unauthenticated anon returns 0 rows for firms'
);

select results_eq(
  'select count(*)::integer from public.firm_members',
  array[0],
  'Unauthenticated anon returns 0 rows for firm_members'
);

select results_eq(
  'select count(*)::integer from public.clients',
  array[0],
  'Unauthenticated anon returns 0 rows for clients'
);

select results_eq(
  'select count(*)::integer from public.client_access',
  array[0],
  'Unauthenticated anon returns 0 rows for client_access'
);

select results_eq(
  'select count(*)::integer from public.documents',
  array[0],
  'Unauthenticated anon returns 0 rows for documents'
);

select results_eq(
  'select count(*)::integer from public.suppliers',
  array[0],
  'Unauthenticated anon returns 0 rows for suppliers'
);

select results_eq(
  'select count(*)::integer from public.invoices',
  array[0],
  'Unauthenticated anon returns 0 rows for invoices'
);

-- ============================================================================
-- 7. Finish Test Suite & Rollback
-- ============================================================================

-- Reset role to superuser before finish
reset role;

select * from finish();

rollback;
