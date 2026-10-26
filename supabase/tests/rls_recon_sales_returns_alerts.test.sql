-- pgTAP Test Suite: RLS Reconciliation, Sales, Returns, and Alerts
--
-- Target File: supabase/tests/rls_recon_sales_returns_alerts.test.sql
-- Covers:
--   1. Setup:
--      - Test firms A & B, test clients under each.
--      - Test users (Firm A staff, Client A owner, Firm B staff).
--      - Populate test records for:
--        * reconciliation_runs
--        * reconciliation_results
--        * sales_entries
--        * sales_invoices
--        * return_periods
--        * return_drafts
--        * alerts
--   2. Assertions:
--      - Firm A staff can see Firm A sales_entries, return_drafts, reconciliation_results, alerts.
--      - Firm B staff cannot see Firm A records across any of these tables.
--      - Client A owner can insert and read sales_entries for Client A.
--      - Client A owner CANNOT update reconciliation_results (read-only for client owner).
--      - Client A owner CANNOT see alerts belonging to other clients or other firms.
--   3. Standard pgTAP harness with rollback at the end.

begin;

-- Initialize pgTAP plan: 38 assertions
select plan(38);

-- ============================================================================
-- 0. Environment Setup & Grants
-- ============================================================================

-- Grant schema and table access so RLS policies are the sole access filter
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;

-- ============================================================================
-- 1. Test Fixtures Setup (Run as Superuser / postgres)
-- ============================================================================

-- Test Users:
-- User 1: Firm A Staff   ('00000000-0000-0000-0000-000000000001')
-- User 2: Client A Owner  ('00000000-0000-0000-0000-000000000002')
-- User 3: Firm B Staff   ('00000000-0000-0000-0000-000000000003')

insert into auth.users (id, aud, role, email)
values
  ('00000000-0000-0000-0000-000000000001'::uuid, 'authenticated', 'authenticated', 'firm_a_staff@test.local'),
  ('00000000-0000-0000-0000-000000000002'::uuid, 'authenticated', 'authenticated', 'client_a_owner@test.local'),
  ('00000000-0000-0000-0000-000000000003'::uuid, 'authenticated', 'authenticated', 'firm_b_staff@test.local')
on conflict (id) do nothing;

-- Test Firms: Firm A & Firm B
insert into public.firms (id, name, created_by)
values
  ('11111111-1111-1111-1111-111111111111'::uuid, 'Test Firm A', '00000000-0000-0000-0000-000000000001'::uuid),
  ('22222222-2222-2222-2222-222222222222'::uuid, 'Test Firm B', '00000000-0000-0000-0000-000000000003'::uuid)
on conflict (id) do update set name = excluded.name;

-- Firm Members:
insert into public.firm_members (firm_id, user_id, role)
values
  ('11111111-1111-1111-1111-111111111111'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'staff'),
  ('22222222-2222-2222-2222-222222222222'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, 'staff')
on conflict (firm_id, user_id) do update set role = excluded.role;

-- Test Clients:
-- Client A1 (under Firm A): 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
-- Client A2 (under Firm A): 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa02'
-- Client B1 (under Firm B): 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
insert into public.clients (id, firm_id, legal_name, trade_name, gstin, state_code, scheme, aato_band)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'Client A1 Legal', 'Client A1 Trade', '27AAAAA0000A1Z5', '27', 'regular', 'below_40l'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa02'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'Client A2 Legal', 'Client A2 Trade', '27AAAAA0000A2Z4', '27', 'regular', 'below_40l'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, 'Client B1 Legal', 'Client B1 Trade', '27BBBBB0000B1Z3', '27', 'regular', 'below_40l')
on conflict (id) do nothing;

-- Client Access: User 2 is Owner of Client A1
insert into public.client_access (firm_id, client_id, user_id, role)
values
  ('11111111-1111-1111-1111-111111111111'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '00000000-0000-0000-0000-000000000002'::uuid, 'owner')
on conflict (client_id, user_id) do update set role = excluded.role;

-- Populate reconciliation_runs
insert into public.reconciliation_runs (id, firm_id, client_id, period_fp, status, started_at, summary)
values
  ('10000000-0000-0000-0000-000000000001'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '042026', 'completed', clock_timestamp(), '{"matched": 1}'::jsonb),
  ('20000000-0000-0000-0000-000000000001'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, '042026', 'completed', clock_timestamp(), '{"matched": 1}'::jsonb)
on conflict (id) do nothing;

-- Populate reconciliation_results
insert into public.reconciliation_results (id, run_id, status, match_pass, diff_taxable, diff_tax, itc_at_risk, user_decision)
values
  ('10000000-0000-0000-0000-000000000002'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'matched', 1, 0.00, 0.00, 0.00, 'none'),
  ('20000000-0000-0000-0000-000000000002'::uuid, '20000000-0000-0000-0000-000000000001'::uuid, 'matched', 1, 0.00, 0.00, 0.00, 'none')
on conflict (id) do nothing;

-- Populate sales_entries
insert into public.sales_entries (id, firm_id, client_id, entry_date, cash_total, upi_total, taxable_sales, exempt_sales, source)
values
  ('10000000-0000-0000-0000-000000000003'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '2026-04-15', 5000.00, 3000.00, 8000.00, 0.00, 'manual'),
  ('20000000-0000-0000-0000-000000000003'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, '2026-04-15', 2000.00, 1000.00, 3000.00, 0.00, 'manual')
on conflict (id) do nothing;

-- Populate sales_invoices
insert into public.sales_invoices (id, firm_id, client_id, invoice_no, invoice_date, place_of_supply, taxable_value, cgst, sgst, igst, cess, total, doc_type, status)
values
  ('10000000-0000-0000-0000-000000000004'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'INV-A-001', '2026-04-10', '27', 10000.00, 900.00, 900.00, 0.00, 0.00, 11800.00, 'tax_invoice', 'approved'),
  ('20000000-0000-0000-0000-000000000004'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, 'INV-B-001', '2026-04-10', '27', 5000.00, 450.00, 450.00, 0.00, 0.00, 5900.00, 'tax_invoice', 'approved')
on conflict (id) do nothing;

-- Populate return_periods
insert into public.return_periods (id, firm_id, client_id, return_type, fp, due_date, status)
values
  ('10000000-0000-0000-0000-000000000005'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'gstr1', '042026', '2026-05-11', 'draft'),
  ('20000000-0000-0000-0000-000000000005'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, 'gstr1', '042026', '2026-05-11', 'draft')
on conflict (id) do nothing;

-- Populate return_drafts
insert into public.return_drafts (id, return_period_id, version, payload, created_by)
values
  ('10000000-0000-0000-0000-000000000006'::uuid, '10000000-0000-0000-0000-000000000005'::uuid, 1, '{"summary": {"b2b": 1}}'::jsonb, '00000000-0000-0000-0000-000000000001'::uuid),
  ('20000000-0000-0000-0000-000000000006'::uuid, '20000000-0000-0000-0000-000000000005'::uuid, 1, '{"summary": {"b2b": 1}}'::jsonb, '00000000-0000-0000-0000-000000000003'::uuid)
on conflict (id) do nothing;

-- Populate alerts:
--   Alert A1: Firm A, Client A1
--   Alert A2: Firm A, Client A2 (different client under Firm A)
--   Alert A_Firm: Firm A, client_id NULL (firm-level alert)
--   Alert B1: Firm B, Client B1
insert into public.alerts (id, firm_id, client_id, kind, severity, title, body, status)
values
  ('10000000-0000-0000-0000-000000000007'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'deadline', 'info', 'GSTR-1 Due Soon for Client A1', 'Please review and approve return draft.', 'open'),
  ('10000000-0000-0000-0000-000000000008'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa02'::uuid, 'deadline', 'warn', 'GSTR-1 Due Soon for Client A2', 'Client A2 needs attention.', 'open'),
  ('10000000-0000-0000-0000-000000000009'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, null, 'rule_change', 'info', 'New CBIC Notification', 'Firm wide rule change advisory.', 'open'),
  ('20000000-0000-0000-0000-000000000007'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, 'deadline', 'info', 'GSTR-1 Due Soon for Client B1', 'Firm B alert.', 'open')
on conflict (id) do nothing;


-- ============================================================================
-- 2. ASSERTIONS: Firm A Staff (User 1)
-- ============================================================================

-- Impersonate Firm A Staff
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000000001"}', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

-- 1. Firm A staff can see Firm A sales_entries
select ok(
  exists (select 1 from public.sales_entries where id = '10000000-0000-0000-0000-000000000003'),
  'Firm A staff can see Firm A sales_entries'
);

-- 2. Firm A staff can see Firm A sales_invoices
select ok(
  exists (select 1 from public.sales_invoices where id = '10000000-0000-0000-0000-000000000004'),
  'Firm A staff can see Firm A sales_invoices'
);

-- 3. Firm A staff can see Firm A return_periods
select ok(
  exists (select 1 from public.return_periods where id = '10000000-0000-0000-0000-000000000005'),
  'Firm A staff can see Firm A return_periods'
);

-- 4. Firm A staff can see Firm A return_drafts
select ok(
  exists (select 1 from public.return_drafts where id = '10000000-0000-0000-0000-000000000006'),
  'Firm A staff can see Firm A return_drafts'
);

-- 5. Firm A staff can see Firm A reconciliation_runs
select ok(
  exists (select 1 from public.reconciliation_runs where id = '10000000-0000-0000-0000-000000000001'),
  'Firm A staff can see Firm A reconciliation_runs'
);

-- 6. Firm A staff can see Firm A reconciliation_results
select ok(
  exists (select 1 from public.reconciliation_results where id = '10000000-0000-0000-0000-000000000002'),
  'Firm A staff can see Firm A reconciliation_results'
);

-- 7. Firm A staff can see Firm A alerts (Client A1 alert)
select ok(
  exists (select 1 from public.alerts where id = '10000000-0000-0000-0000-000000000007'),
  'Firm A staff can see Firm A Client A1 alert'
);

-- 8. Firm A staff can see Firm A alerts for other client A2
select ok(
  exists (select 1 from public.alerts where id = '10000000-0000-0000-0000-000000000008'),
  'Firm A staff can see Firm A Client A2 alert'
);

-- 9. Firm A staff can see Firm A firm-level alert
select ok(
  exists (select 1 from public.alerts where id = '10000000-0000-0000-0000-000000000009'),
  'Firm A staff can see Firm A firm-level alert'
);

-- 10. Firm A staff CAN update reconciliation_results
update public.reconciliation_results
set user_decision = 'accepted'
where id = '10000000-0000-0000-0000-000000000002';

select is(
  (select user_decision::text from public.reconciliation_results where id = '10000000-0000-0000-0000-000000000002'),
  'accepted',
  'Firm A staff can update reconciliation_results'
);


-- ============================================================================
-- 3. ASSERTIONS: Firm B Staff (User 3) cannot see Firm A records
-- ============================================================================

-- Impersonate Firm B Staff
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000000003"}', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

-- 11. Firm B staff cannot see Firm A sales_entries
select is_empty(
  'select 1 from public.sales_entries where firm_id = ''11111111-1111-1111-1111-111111111111''',
  'Firm B staff cannot see Firm A sales_entries'
);

-- 12. Firm B staff cannot see Firm A sales_invoices
select is_empty(
  'select 1 from public.sales_invoices where firm_id = ''11111111-1111-1111-1111-111111111111''',
  'Firm B staff cannot see Firm A sales_invoices'
);

-- 13. Firm B staff cannot see Firm A return_periods
select is_empty(
  'select 1 from public.return_periods where firm_id = ''11111111-1111-1111-1111-111111111111''',
  'Firm B staff cannot see Firm A return_periods'
);

-- 14. Firm B staff cannot see Firm A return_drafts
select is_empty(
  'select 1 from public.return_drafts where id = ''10000000-0000-0000-0000-000000000006''',
  'Firm B staff cannot see Firm A return_drafts'
);

-- 15. Firm B staff cannot see Firm A reconciliation_runs
select is_empty(
  'select 1 from public.reconciliation_runs where firm_id = ''11111111-1111-1111-1111-111111111111''',
  'Firm B staff cannot see Firm A reconciliation_runs'
);

-- 16. Firm B staff cannot see Firm A reconciliation_results
select is_empty(
  'select 1 from public.reconciliation_results where id = ''10000000-0000-0000-0000-000000000002''',
  'Firm B staff cannot see Firm A reconciliation_results'
);

-- 17. Firm B staff cannot see Firm A alerts
select is_empty(
  'select 1 from public.alerts where firm_id = ''11111111-1111-1111-1111-111111111111''',
  'Firm B staff cannot see Firm A alerts'
);

-- 18. Sanity check: Firm B staff CAN see Firm B sales_entries
select ok(
  exists (select 1 from public.sales_entries where id = '20000000-0000-0000-0000-000000000003'),
  'Firm B staff can see Firm B sales_entries'
);

-- 19. Sanity check: Firm B staff CAN see Firm B alerts
select ok(
  exists (select 1 from public.alerts where id = '20000000-0000-0000-0000-000000000007'),
  'Firm B staff can see Firm B alerts'
);

-- 19b. Firm B staff CANNOT insert sales_entries into Firm A
select throws_ok(
  $$insert into public.sales_entries (id, firm_id, client_id, entry_date, cash_total, upi_total, taxable_sales, exempt_sales, source)
    values ('10000000-0000-0000-0000-000000000099', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-04-15', 100, 0, 100, 0, 'manual')$$,
  '42501'::character(5),
  null::text,
  'Firm B staff CANNOT insert sales_entries into Firm A (throws 42501)'
);

-- 19c. Firm B staff UPDATE on Firm A alerts affects 0 rows
select results_eq(
  $$with upd as (
      update public.alerts
      set status = 'dismissed'
      where id = '10000000-0000-0000-0000-000000000007'
      returning 1
    ) select count(*)::integer from upd$$,
  array[0],
  'Firm B staff UPDATE on Firm A alerts affects 0 rows'
);


-- ============================================================================
-- 4. ASSERTIONS: Client A Owner (User 2)
-- ============================================================================

-- Impersonate Client A Owner
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000000002"}', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

-- 20. Client A owner can read sales_entries for Client A
select ok(
  exists (select 1 from public.sales_entries where id = '10000000-0000-0000-0000-000000000003'),
  'Client A owner can read sales_entries for Client A'
);

-- 21. Client A owner can insert sales_entries for Client A
select lives_ok(
  $$insert into public.sales_entries (id, firm_id, client_id, entry_date, cash_total, upi_total, taxable_sales, exempt_sales, source)
    values ('10000000-0000-0000-0000-000000000010', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-04-16', 500.00, 250.00, 750.00, 0.00, 'manual')$$,
  'Client A owner can insert sales_entries for Client A'
);

-- 22. Client A owner can read the newly inserted sales_entry
select ok(
  exists (select 1 from public.sales_entries where id = '10000000-0000-0000-0000-000000000010'),
  'Client A owner can read newly inserted sales_entry'
);

-- 23. Client A owner CANNOT insert sales_entries for Client B
select throws_ok(
  $$insert into public.sales_entries (id, firm_id, client_id, entry_date, cash_total, upi_total, taxable_sales, exempt_sales, source)
    values ('20000000-0000-0000-0000-000000000010', '22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '2026-04-16', 500.00, 250.00, 750.00, 0.00, 'manual')$$,
  '42501',
  null,
  'Client A owner CANNOT insert sales_entries for Client B'
);

-- 24. Client A owner can read reconciliation_results for Client A
select ok(
  exists (select 1 from public.reconciliation_results where id = '10000000-0000-0000-0000-000000000002'),
  'Client A owner can read reconciliation_results for Client A'
);

-- 25. Client A owner CANNOT update reconciliation_results (affects 0 rows)
select results_eq(
  'with upd as (
     update public.reconciliation_results
     set user_decision = ''disputed''
     where id = ''10000000-0000-0000-0000-000000000002''
     returning 1
   ) select count(*)::integer from upd',
  array[0],
  'Client A owner UPDATE on reconciliation_results affects exactly 0 rows'
);

-- 26. Client A owner CANNOT update reconciliation_runs (affects 0 rows)
select results_eq(
  'with upd as (
     update public.reconciliation_runs
     set status = ''failed''
     where id = ''10000000-0000-0000-0000-000000000001''
     returning 1
   ) select count(*)::integer from upd',
  array[0],
  'Client A owner UPDATE on reconciliation_runs affects exactly 0 rows'
);

-- 27. Client A owner CAN see alerts belonging to Client A1
select ok(
  exists (select 1 from public.alerts where id = '10000000-0000-0000-0000-000000000007'),
  'Client A owner CAN see alerts belonging to Client A1'
);

-- 28. Client A owner CANNOT see alerts belonging to Client A2 (different client under Firm A)
select is_empty(
  'select 1 from public.alerts where id = ''10000000-0000-0000-0000-000000000008''',
  'Client A owner CANNOT see alerts belonging to Client A2'
);

-- 29. Client A owner CANNOT see firm-level alerts (client_id is null)
select is_empty(
  'select 1 from public.alerts where id = ''10000000-0000-0000-0000-000000000009''',
  'Client A owner CANNOT see firm-level alerts'
);

-- 30. Client A owner CANNOT see alerts belonging to Firm B / Client B1
select is_empty(
  'select 1 from public.alerts where id = ''20000000-0000-0000-0000-000000000007''',
  'Client A owner CANNOT see alerts belonging to other firms'
);

-- 31. Client A owner sees exactly 1 alert in total (only Alert A1)
select is(
  (select count(*)::integer from public.alerts),
  1,
  'Client A owner sees only their own client alerts in total'
);

-- 32. Client A owner can read own client sales_invoices
select ok(
  exists (select 1 from public.sales_invoices where id = '10000000-0000-0000-0000-000000000004'),
  'Client A owner can read own client sales_invoices'
);

-- 33. Client A owner CANNOT read Firm B sales_invoices
select is_empty(
  'select 1 from public.sales_invoices where id = ''20000000-0000-0000-0000-000000000004''',
  'Client A owner CANNOT read Firm B sales_invoices'
);

-- 34. Client A owner CANNOT insert sales_invoices
select throws_ok(
  $$insert into public.sales_invoices (id, firm_id, client_id, invoice_no, invoice_date, place_of_supply, taxable_value, cgst, sgst, total, doc_type, status)
    values ('10000000-0000-0000-0000-000000000098', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'INV-OWNER-01', '2026-04-10', '27', 1000, 90, 90, 1180, 'tax_invoice', 'draft')$$,
  '42501'::character(5),
  null::text,
  'Client A owner CANNOT insert sales_invoices (throws 42501)'
);

-- 35. Client A owner CANNOT insert return_drafts
select throws_ok(
  $$insert into public.return_drafts (id, return_period_id, version, payload, created_by)
    values ('10000000-0000-0000-0000-000000000097', '10000000-0000-0000-0000-000000000005', 2, '{}'::jsonb, '00000000-0000-0000-0000-000000000002')$$,
  '42501'::character(5),
  null::text,
  'Client A owner CANNOT insert return_drafts (throws 42501)'
);

-- 36. Client A owner CANNOT insert alerts
select throws_ok(
  $$insert into public.alerts (id, firm_id, client_id, kind, severity, title, body, status)
    values ('10000000-0000-0000-0000-000000000096', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'deadline', 'urgent', 'Fake Alert', 'Body', 'open')$$,
  '42501'::character(5),
  null::text,
  'Client A owner CANNOT insert alerts (throws 42501)'
);

-- ============================================================================
-- 5. FINISH & ROLLBACK
-- ============================================================================

-- Reset role to superuser before finish
reset role;

select * from finish();

rollback;
