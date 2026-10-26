# Database RLS & Security pgTAP Test Suite Review Report

**Reviewer Role:** Lane L3 (Read-Only Reviewer)  
**Target Test Suites:**
- `supabase/tests/rls_tenancy_documents_purchases.test.sql` (50 assertions)
- `supabase/tests/rls_recon_sales_returns_alerts.test.sql` (31 assertions)
- `supabase/tests/rls_rules_audit_storage.test.sql` (58 assertions)

**Schema Migrations Reviewed:**
- `20261101000000_base.sql` (Enums, security-definer helper functions, triggers)
- `20261101000010_tenancy.sql` (Tenancy, memberships, client access, platform admins)
- `20261101000020_documents.sql` (Document metadata and storage policies)
- `20261101000030_purchases.sql` (Suppliers, invoices, invoice lines, payments)
- `20261101000060_reconciliation.sql` (Reconciliation runs and item results)
- `20261101000070_sales_returns.sql` (Sales entries, outward invoices, return drafts)
- `20261101000080_rules.sql` (Statutory rate rules, rule params, rule snapshots)
- `20261101000090_audit_alerts.sql` (Append-only audit trail and compliance alerts)

---

## 1. Executive Summary

This review evaluates the completeness, rigor, and fault-tolerance of the pgTAP test suites enforcing Row Level Security (RLS), multi-tenant isolation, statutory immutability, and storage access control across the application database.

### Key Findings Summary
1. **Critical Vacuous Pass Flaws (Compound Filter Masking):**
   In `rls_recon_sales_returns_alerts.test.sql` (Tests 14 and 16), cross-firm read assertions for `return_drafts` and `reconciliation_results` join through parent tables (`return_periods` and `reconciliation_runs`) using explicit `where parent.firm_id = ...` conditions. Because the parent tables return zero rows under RLS, the inner join evaluates to empty **even if RLS is completely disabled or misconfigured on `return_drafts` and `reconciliation_results`**.
2. **Missing Coverage of Statutory Immutability (`rule_snapshots`):**
   `public.rule_snapshots` is defined in migration `080_rules.sql` as a critical append-only GST rule versioning registry. It is **completely unseeded and untested** across all three test suites. Neither read access, platform-admin inserts, nor strict immutability (denial of UPDATE and DELETE) are verified.
3. **Incomplete Negative Write Coverage for Non-Admin & CA Firm Roles:**
   While platform admin writes to `gst_rate_rules` are verified, CA Firm Admins (`public.firm_members.role = 'admin'`) and Outsiders are never tested against statutory rules (`gst_rate_rules`, `rule_params`, `rule_snapshots`). Firm Admins must be strictly prohibited from altering statutory rules, but no test verifies this boundary.
4. **SME Client Owner Privilege Escalation Gaps:**
   Client Owners (`client_access.role = 'owner'`) are tested for basic cross-firm isolation, but tests fail to assert that SME owners cannot inspect `public.firms`, inspect `public.platform_admins`, modify their client metadata (`public.clients`), or write directly to purchase invoices, suppliers, sales invoices, return drafts, or compliance alerts.
5. **Storage Lifecycle & Path Security Gaps:**
   In `rls_rules_audit_storage.test.sql`, storage object `UPDATE` and `DELETE` policies are completely unasserted. Path traversal attacks (e.g. `../`), mismatched cross-firm/client pairings (`{firm_a}/{client_b}`), and outsider storage attempts are not tested.

---

## 2. Vacuous Pass Analysis

A test passes vacuously when the assertion succeeds for reasons unrelated to the security policy under test (e.g. asserting zero rows returned on an empty table, or filtering out rows via a secondary joined table whose own filters eliminate the rows).

### 2.1 Critical Compound Filter Masking in `rls_recon_sales_returns_alerts.test.sql`

#### Case A: Test 14 — Cross-Firm Read Isolation on `return_drafts`
* **File:** `supabase/tests/rls_recon_sales_returns_alerts.test.sql` (Lines 291–295)
* **Current SQL Assertion:**
  ```sql
  -- 14. Firm B staff cannot see Firm A return_drafts
  select is_empty(
    'select 1 from public.return_drafts rd join public.return_periods rp on rp.id = rd.return_period_id where rp.firm_id = ''11111111-1111-1111-1111-111111111111''',
    'Firm B staff cannot see Firm A return_drafts'
  );
  ```
* **Why it passes vacuously:**  
  `public.return_drafts` does not have a `firm_id` column; it links to `return_periods`. When Firm B staff executes this query, `public.return_periods` already returns 0 rows where `firm_id = '11111111-1111-1111-1111-111111111111'` due to Test 13. Because `rp` produces 0 rows, the `JOIN` returns 0 rows **regardless of whether RLS on `return_drafts` is active, misconfigured, or permits reading all records**. If an attacker or bug exposed all return drafts via `select * from return_drafts`, Test 14 would still pass.
* **Remediation:**  
  Query `return_drafts` directly by its primary key (`10000000-0000-0000-0000-000000000006`) without joining `return_periods`:
  ```sql
  select is_empty(
    'select 1 from public.return_drafts where id = ''10000000-0000-0000-0000-000000000006''',
    'Firm B staff cannot select Firm A return_drafts by primary key'
  );
  ```

#### Case B: Test 16 — Cross-Firm Read Isolation on `reconciliation_results`
* **File:** `supabase/tests/rls_recon_sales_returns_alerts.test.sql` (Lines 303–307)
* **Current SQL Assertion:**
  ```sql
  -- 16. Firm B staff cannot see Firm A reconciliation_results
  select is_empty(
    'select 1 from public.reconciliation_results rr join public.reconciliation_runs r on r.id = rr.run_id where r.firm_id = ''11111111-1111-1111-1111-111111111111''',
    'Firm B staff cannot see Firm A reconciliation_results'
  );
  ```
* **Why it passes vacuously:**  
  Same compound-join defect as Test 14. The `JOIN` on `reconciliation_runs r where r.firm_id = '11111111-...'` is already empty because Firm B staff cannot see Firm A's reconciliation runs. This masks whether `public.reconciliation_results` actually enforces RLS independently.
* **Remediation:**  
  Query `reconciliation_results` directly by its primary key (`10000000-0000-0000-0000-000000000002`):
  ```sql
  select is_empty(
    'select 1 from public.reconciliation_results where id = ''10000000-0000-0000-0000-000000000002''',
    'Firm B staff cannot select Firm A reconciliation_results by primary key'
  );
  ```

---

### 2.2 Fragile and Inconclusive UPDATE Assertions

#### Case A: Test 25 & 26 in `rls_recon_sales_returns_alerts.test.sql`
* **File:** `supabase/tests/rls_recon_sales_returns_alerts.test.sql` (Lines 368–389)
* **Current SQL Assertions:**
  ```sql
  -- 25. Client A owner CANNOT update reconciliation_results (read-only for client owner)
  update public.reconciliation_results
  set user_decision = 'disputed'
  where id = '10000000-0000-0000-0000-000000000002';

  select is(
    (select user_decision::text from public.reconciliation_results where id = '10000000-0000-0000-0000-000000000002'),
    'accepted',
    'Client A owner CANNOT update reconciliation_results (read-only for client owner)'
  );

  -- 26. Client A owner CANNOT update reconciliation_runs
  update public.reconciliation_runs
  set status = 'failed'
  where id = '10000000-0000-0000-0000-000000000001';

  select is(
    (select status from public.reconciliation_runs where id = '10000000-0000-0000-0000-000000000001'),
    'completed',
    'Client A owner CANNOT update reconciliation_runs'
  );
  ```
* **Why it is fragile:**  
  In PostgreSQL, an `UPDATE` statement that matches 0 rows under RLS does not raise an error; it simply updates 0 rows. Checking that the column value remained `'accepted'` or `'completed'` succeeds if the row was never updated, but it also passes if the `UPDATE` failed due to an unhandled syntax error, an invalid predicate, or if the update modified other unasserted columns.
* **Remediation:**  
  Explicitly verify that the `UPDATE` statement matched and affected **0 rows** using a Common Table Expression (CTE) with `RETURNING 1`:
  ```sql
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
  ```

---

### 2.3 Omitted Dependent Domain Tables in `rls_tenancy_documents_purchases.test.sql`

* **Unseeded Tables:** `public.invoice_lines`, `public.invoice_payments`.
* **Risk:**  
  Migration `030_purchases.sql` creates RLS policies on `invoice_lines` and `invoice_payments` that navigate the `invoices` parent foreign key. Because neither table is seeded with test records, any assertion asserting `count(*) = 0` would pass vacuously because the tables are empty across all tenants. Cross-firm leakage or client-owner visibility into invoice lines and payments is completely untested.

---

## 3. Missing Negative Test Cases

### 3.1 Cross-Firm Isolation Gaps

| Suite File | Target Table | Missing Negative Test Case | Security Impact |
| :--- | :--- | :--- | :--- |
| `rls_tenancy_documents_purchases` | `public.documents` | Firm B Staff selecting Firm A documents (`select * from documents where firm_id = '1111...'`) | Firm B staff could view sensitive client purchase bills. |
| `rls_tenancy_documents_purchases` | `public.suppliers` | Firm B Staff selecting Firm A suppliers (`select * from suppliers where firm_id = '1111...'`) | Firm B staff could view vendor relationships and GSTINs of competitor CA firm. |
| `rls_tenancy_documents_purchases` | `public.invoices` | Firm A Staff attempting INSERT of invoice belonging to Firm B | Cross-tenant data injection into competitor firm. |
| `rls_recon_sales_returns_alerts` | `public.sales_entries` | Firm B Staff attempting INSERT/UPDATE on Firm A client sales | Cross-firm financial data tampering. |
| `rls_recon_sales_returns_alerts` | `public.alerts` | Firm B Staff attempting to dismiss/update Firm A alert (`status = 'dismissed'`) | Silencing statutory deadline warnings of another firm. |

---

### 3.2 SME Client Owner Privilege Escalation Gaps

In the statutory model, SME Client Owners (`client_access.role = 'owner'`) must have restricted permissions: they may view their own financial records and submit source sales entries, but **must never** manage CA firm rosters, modify client tax registrations, view platform administrator configurations, or write directly to CA-managed statutory returns and invoices.

1. **Firm Metadata Inspection (`public.firms`):**  
   Policy `firms_select` requires `is_firm_member(id) or is_platform_admin()`. Client Owner A is neither. However, `rls_tenancy_documents_purchases.test.sql` never asserts that Client Owner A receives 0 rows when querying `public.firms`.
2. **Platform Administrator Roster Inspection (`public.platform_admins`):**  
   Policy `platform_admins_select` requires `is_platform_admin()`. No test verifies that Client Owner A (or Firm Staff) is blocked from querying `public.platform_admins`.
3. **Client Configuration Tampering (`public.clients`):**  
   Policy `clients_update` allows updates **only** by `is_firm_member(firm_id)` or `is_platform_admin()`. Client Owners must **not** be allowed to change their `gstin`, `scheme`, `aato_band`, or reassign their `firm_id`. Neither test suite asserts that Client Owner A's `UPDATE` on `public.clients` is rejected.
4. **Direct Purchase Invoice & Supplier Insertion:**  
   `invoices_insert` and `suppliers_insert` explicitly require `is_firm_member(firm_id) or is_platform_admin()`. Client Owners upload raw documents; they do not insert parsed invoices or suppliers directly. No test asserts that a Client Owner attempting `INSERT` into `invoices` or `suppliers` throws an error or is denied.
5. **Direct Return Draft & Return Period Insertion:**  
   `return_drafts_insert` and `return_periods_insert` restrict writes to CA firm members. No test verifies that a Client Owner attempting to create or update return drafts is rejected.
6. **Direct Alert Generation:**  
   `alerts_insert` restricts creation to CA firm members or platform admins. Client owners must not be able to forge system alerts. No test verifies this restriction.

---

### 3.3 Statutory Append-Only Immutability Gaps

#### Case A: `public.audit_events` Immutability & Insertion Authorization
Migration `090_audit_alerts.sql` establishes that `public.audit_events` is append-only via the trigger function `public.prevent_audit_modification()` and strict RLS policies.
* **Tested:** Superuser, Firm Admin, and Platform Admin attempts to `UPDATE` or `DELETE` are asserted and blocked.
* **Missing Tests:**
  1. **Firm Staff attempt to UPDATE or DELETE:** Regular staff members are the primary operational actors; immutability against staff roles must be verified.
  2. **Client Owner attempt to UPDATE or DELETE:** Client owners must not be able to scrub audit trails.
  3. **Unauthorized INSERT / Actor Spoofing:**  
     Policy `audit_events_insert` enforces:
     ```sql
     auth.uid() is not null
     and (actor_id is null or actor_id = auth.uid())
     and (public.is_firm_member(firm_id) or public.is_platform_admin())
     ```
     No tests verify that:
     * A Client Owner cannot insert into `audit_events`.
     * An Outsider cannot insert into `audit_events`.
     * A Firm Staff member cannot forge an audit event for another firm (`firm_id = Firm B`).
     * A Firm Staff member cannot spoof `actor_id` (e.g. setting `actor_id` to the Firm Admin's UUID).

#### Case B: `public.rule_snapshots` Immutability
Migration `080_rules.sql` defines `public.rule_snapshots`. By design, it has:
* `rule_snapshots_select` for `authenticated` users.
* `rule_snapshots_insert` for `is_platform_admin()`.
* **Zero UPDATE or DELETE policies**, making it strictly append-only.
* **Missing Tests:** `rule_snapshots` is **completely absent** from all tests. There are no tests for:
  1. Platform Admin successful insert.
  2. Non-admin (Firm Admin, Staff, Client Owner) insert rejection.
  3. UPDATE attempt by any user (including Platform Admin and Superuser).
  4. DELETE attempt by any user (including Platform Admin and Superuser).

---

### 3.4 Non-Admin Writes to Statutory Rules

In `rls_rules_audit_storage.test.sql`:
1. **Firm Admin Write Denial:**  
   Firm Admins are administrators of CA firms (`Test CA Firm A`), **not platform administrators**. Can a CA Firm Admin modify GST rate rules or rule parameters? Under RLS, only `is_platform_admin()` may write. However, the test suite tests Firm Staff (Tests 20–22) and Client Owner (Tests 23–25), but **never tests Firm Admin**. A Firm Admin could erroneously be granted write access if policy conditions confused `is_firm_admin` with `is_platform_admin`.
2. **`public.rule_params` Mutation Omission:**  
   Tests 20–29 thoroughly test `INSERT`, `UPDATE`, and `DELETE` on `gst_rate_rules`, but perform **zero mutation tests on `rule_params`**. Neither Firm Staff, Client Owner, Firm Admin, nor Platform Admin are tested for writing to `rule_params`.

---

### 3.5 Storage Path Traversal & Lifecycle Isolation Gaps

In `rls_rules_audit_storage.test.sql`:
1. **Storage Object UPDATE & DELETE Unasserted:**  
   The storage policies defined in `020_documents.sql` specify:
   * `documents_storage_update`: permitted only for Platform Admin or Firm Member. (Client owners **cannot** update storage objects).
   * `documents_storage_delete`: permitted only for Platform Admin or Firm Admin. (Firm staff and client owners **cannot** delete storage objects).
   **Zero tests exist for storage `UPDATE` or `DELETE`**.
2. **Mismatched Cross-Firm/Client Path Upload:**  
   The storage insert policy validates:
   ```sql
   public.is_client_owner((storage.foldername(name))[2]::uuid)
   and exists (
     select 1 from public.clients c
     where c.id = (storage.foldername(name))[2]::uuid
       and c.firm_id = (storage.foldername(name))[1]::uuid
   )
   ```
   What happens if Client 1 Owner uploads a path with Firm A's UUID as segment 1, but Client 3's UUID (which belongs to Firm B) as segment 2? The test only checks `{firm_b}/{client_b}`. It never tests the mismatched path `{firm_a}/{client_b}`.
3. **Storage Path Traversal:**  
   No test attempts directory traversal tricks (e.g. `11111111-1111-1111-1111-111111111111/../22222222-2222-2222-2222-222222222222/leak.pdf` or paths with invalid segment counts).
4. **Outsider Storage Access:**  
   While an anonymous user is tested in Test 58, an authenticated user who is neither a firm member nor a client owner (`e0000000-0000-0000-0000-000000000001`) is never tested on `storage.objects`.

---

## 4. Actionable Recommendations & Concrete SQL Assertions

To eliminate vacuous passes and establish exhaustive negative coverage, incorporate the following SQL snippets directly into the test suites.

### 4.1 Enhancements for `supabase/tests/rls_tenancy_documents_purchases.test.sql`

```sql
-- ============================================================================
-- Additional Assertions for rls_tenancy_documents_purchases.test.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Firm B Staff Isolation: Missing Documents and Suppliers Checks
-- ----------------------------------------------------------------------------
-- Impersonate Firm B Staff
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000002"}', true);
select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is_empty(
  'select * from public.documents where firm_id = ''11111111-1111-1111-1111-111111111111''',
  'Firm B staff CANNOT select Firm A documents (empty set)'
);

select is_empty(
  'select * from public.suppliers where firm_id = ''11111111-1111-1111-1111-111111111111''',
  'Firm B staff CANNOT select Firm A suppliers (empty set)'
);

-- ----------------------------------------------------------------------------
-- 2. Cross-Firm Negative Writes: Firm A Staff inserting into Firm B
-- ----------------------------------------------------------------------------
-- Impersonate Firm A Staff
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "a0000000-0000-0000-0000-000000000002"}', true);
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select throws_ok(
  'insert into public.invoices (id, firm_id, client_id, invoice_no, invoice_no_norm, invoice_date, place_of_supply, taxable_value, cgst, sgst, igst, total, status, source, itc_state, period_fp)
   values (''41111111-9999-1111-1111-111111111111''::uuid, ''22222222-2222-2222-2222-222222222222''::uuid, ''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb''::uuid, ''HACK-01'', ''HACK01'', ''2026-10-01'', ''27'', 1000, 90, 90, 0, 1180, ''draft'', ''extracted'', ''eligible'', ''102026'')',
  '42501',
  null,
  'Firm A staff CANNOT insert invoices into Firm B (throws 42501)'
);

select throws_ok(
  'insert into public.documents (id, firm_id, client_id, kind, storage_path, original_name, mime_type, size_bytes, sha256, status, period_fp)
   values (''d1111111-9999-1111-1111-111111111111''::uuid, ''22222222-2222-2222-2222-222222222222''::uuid, ''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb''::uuid, ''purchase_bill'', ''firms/2/doc.pdf'', ''doc.pdf'', ''application/pdf'', 100, ''3333333333333333333333333333333333333333333333333333333333333333'', ''uploaded'', ''102026'')',
  '42501',
  null,
  'Firm A staff CANNOT insert documents into Firm B (throws 42501)'
);

-- ----------------------------------------------------------------------------
-- 3. SME Client Owner Privilege Escalation Boundaries
-- ----------------------------------------------------------------------------
-- Impersonate Client Owner A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "c0000000-0000-0000-0000-000000000001"}', true);
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

-- Client Owner cannot view CA firm metadata
select is_empty(
  'select * from public.firms',
  'Client Owner A CANNOT select from public.firms (returns 0 rows)'
);

-- Client Owner cannot view platform admins
select is_empty(
  'select * from public.platform_admins',
  'Client Owner A CANNOT select from public.platform_admins (returns 0 rows)'
);

-- Client Owner cannot modify their client entity
select results_eq(
  'with upd as (
     update public.clients
     set legal_name = ''Hacked Retail Legal Name'', gstin = ''27AAAAA9999A1Z9''
     where id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''
     returning 1
   ) select count(*)::integer from upd',
  array[0],
  'Client Owner A UPDATE on public.clients affects 0 rows (permission denied by RLS)'
);

-- Client Owner cannot insert purchase invoices directly
select throws_ok(
  'insert into public.invoices (id, firm_id, client_id, invoice_no, invoice_no_norm, invoice_date, place_of_supply, taxable_value, cgst, sgst, igst, total, status, source, itc_state, period_fp)
   values (''41111111-8888-1111-1111-111111111111''::uuid, ''11111111-1111-1111-1111-111111111111''::uuid, ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''::uuid, ''INV-BYPASS'', ''INVBYPASS'', ''2026-10-01'', ''27'', 500, 45, 45, 0, 590, ''draft'', ''extracted'', ''eligible'', ''102026'')',
  '42501',
  null,
  'Client Owner A CANNOT insert directly into public.invoices (throws 42501)'
);

-- Client Owner cannot insert suppliers directly
select throws_ok(
  'insert into public.suppliers (id, firm_id, client_id, gstin, name)
   values (''31111111-8888-1111-1111-111111111111''::uuid, ''11111111-1111-1111-1111-111111111111''::uuid, ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''::uuid, ''27HACK1111A1Z1'', ''Supplier Bypass'')',
  '42501',
  null,
  'Client Owner A CANNOT insert directly into public.suppliers (throws 42501)'
);

-- Total suppliers visible across all firms is exactly 1 (Client 1 only)
select results_eq(
  'select count(*)::integer from public.suppliers',
  array[1],
  'Client Owner A total visible suppliers across all firms is exactly 1'
);
```

---

### 4.2 Enhancements for `supabase/tests/rls_recon_sales_returns_alerts.test.sql`

```sql
-- ============================================================================
-- Fixes and Additional Assertions for rls_recon_sales_returns_alerts.test.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Replace Vacuous Pass Assertions (Tests 14 and 16) with Direct Key Lookups
-- ----------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000000003", "role": "authenticated"}', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);

-- Direct key lookup on return_drafts (no join to return_periods)
select is_empty(
  'select 1 from public.return_drafts where id = ''10000000-0000-0000-0000-000000000006''',
  'Firm B staff CANNOT select Firm A return_drafts by primary key'
);

-- Direct key lookup on reconciliation_results (no join to reconciliation_runs)
select is_empty(
  'select 1 from public.reconciliation_results where id = ''10000000-0000-0000-0000-000000000002''',
  'Firm B staff CANNOT select Firm A reconciliation_results by primary key'
);

-- ----------------------------------------------------------------------------
-- 2. Firm B Staff Cross-Firm Write Negatives
-- ----------------------------------------------------------------------------
select throws_ok(
  $$insert into public.sales_entries (id, firm_id, client_id, entry_date, cash_total, upi_total, taxable_sales, exempt_sales, source)
    values ('10000000-0000-0000-0000-000000000099', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-04-15', 100, 0, 100, 0, 'manual')$$,
  '42501',
  null,
  'Firm B staff CANNOT insert sales_entries into Firm A (throws 42501)'
);

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

-- ----------------------------------------------------------------------------
-- 3. Client A Owner Scope and Privilege Limitations
-- ----------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);

-- Client A owner can read their own sales invoices
select ok(
  exists (select 1 from public.sales_invoices where id = '10000000-0000-0000-0000-000000000004'),
  'Client A owner can read own client sales_invoices'
);

-- Client A owner CANNOT read Firm B sales invoices
select is_empty(
  'select 1 from public.sales_invoices where id = ''20000000-0000-0000-0000-000000000004''',
  'Client A owner CANNOT read Firm B sales_invoices'
);

-- Client A owner CANNOT insert sales invoices directly
select throws_ok(
  $$insert into public.sales_invoices (id, firm_id, client_id, invoice_no, invoice_date, place_of_supply, taxable_value, cgst, sgst, total, doc_type, status)
    values ('10000000-0000-0000-0000-000000000098', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'INV-OWNER-01', '2026-04-10', '27', 1000, 90, 90, 1180, 'tax_invoice', 'draft')$$,
  '42501',
  null,
  'Client A owner CANNOT insert sales_invoices (throws 42501)'
);

-- Client A owner CANNOT insert return drafts
select throws_ok(
  $$insert into public.return_drafts (id, return_period_id, version, payload, created_by)
    values ('10000000-0000-0000-0000-000000000097', '10000000-0000-0000-0000-000000000005', 2, '{}'::jsonb, '00000000-0000-0000-0000-000000000002')$$,
  '42501',
  null,
  'Client A owner CANNOT insert return_drafts (throws 42501)'
);

-- Client A owner CANNOT insert alerts
select throws_ok(
  $$insert into public.alerts (id, firm_id, client_id, kind, severity, title, body, status)
    values ('10000000-0000-0000-0000-000000000096', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'deadline', 'urgent', 'Fake Alert', 'Body', 'open')$$,
  '42501',
  null,
  'Client A owner CANNOT insert alerts (throws 42501)'
);
```

---

### 4.3 Enhancements for `supabase/tests/rls_rules_audit_storage.test.sql`

```sql
-- ============================================================================
-- Additional Assertions for rls_rules_audit_storage.test.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Complete Coverage for rule_snapshots (Statutory Immutability)
-- ----------------------------------------------------------------------------
-- Seed initial rule snapshot (run as superuser / reset role)
reset role;
insert into public.rule_snapshots (id, label, checksum, created_at)
values ('rs111111-1111-1111-1111-111111111111'::uuid, 'FY 2026-Q1 Snapshot', 'sha256_mock_checksum_001', '2026-04-01 00:00:00+00')
on conflict (id) do nothing;

-- Verify authenticated users can SELECT rule_snapshots
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "a0000000-0000-0000-0000-000000000002", "role": "authenticated"}', true);
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000002', true);

select results_eq(
  'select count(*)::integer from public.rule_snapshots where id = ''rs111111-1111-1111-1111-111111111111''',
  array[1],
  'Firm Staff can SELECT rule_snapshots'
);

-- Firm Staff CANNOT insert into rule_snapshots
select throws_ok(
  'insert into public.rule_snapshots (id, label, checksum) values (''rs222222-2222-2222-2222-222222222222''::uuid, ''Unauthorized'', ''chk'')',
  '42501',
  null,
  'Firm Staff CANNOT insert into rule_snapshots (throws 42501)'
);

-- Platform Admin CAN insert into rule_snapshots
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "p0000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
select set_config('request.jwt.claim.sub', 'p0000000-0000-0000-0000-000000000001', true);

select lives_ok(
  'insert into public.rule_snapshots (id, label, checksum) values (''rs222222-2222-2222-2222-222222222222''::uuid, ''Platform Admin Snapshot'', ''chk2'')',
  'Platform Admin CAN insert into rule_snapshots'
);

-- Immutability: Platform Admin CANNOT update or delete rule_snapshots
select results_eq(
  'with upd as (
     update public.rule_snapshots set label = ''Tampered'' where id = ''rs111111-1111-1111-1111-111111111111'' returning 1
   ) select count(*)::integer from upd',
  array[0],
  'Platform Admin UPDATE on rule_snapshots affects 0 rows (strictly append-only)'
);

select results_eq(
  'with del as (
     delete from public.rule_snapshots where id = ''rs111111-1111-1111-1111-111111111111'' returning 1
   ) select count(*)::integer from del',
  array[0],
  'Platform Admin DELETE on rule_snapshots affects 0 rows (strictly append-only)'
);

-- ----------------------------------------------------------------------------
-- 2. CA Firm Admin CANNOT Mutate Statutory Rules (gst_rate_rules & rule_params)
-- ----------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "a0000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', true);

select throws_ok(
  'insert into public.gst_rate_rules (hsn_prefix, rate, effective_from, source_ref) values (''9997'', 18.00, ''2026-01-01'', ''CA Admin Attempt'')',
  '42501',
  null,
  'Firm Admin CANNOT insert into gst_rate_rules (throws 42501)'
);

select throws_ok(
  'insert into public.rule_params (key, value, effective_from, source_ref) values (''hack_param'', ''{}''::jsonb, ''2026-01-01'', ''CA Admin Attempt'')',
  '42501',
  null,
  'Firm Admin CANNOT insert into rule_params (throws 42501)'
);

select results_eq(
  'with upd as (
     update public.rule_params set value = ''{"hacked": true}''::jsonb where id = ''rp111111-1111-1111-1111-111111111111'' returning 1
   ) select count(*)::integer from upd',
  array[0],
  'Firm Admin UPDATE on rule_params affects 0 rows'
);

-- ----------------------------------------------------------------------------
-- 3. Unauthorized and Spoofed Audit Event Insertions
-- ----------------------------------------------------------------------------
-- Client Owner cannot insert into audit_events
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "c0000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000001', true);

select throws_ok(
  'insert into public.audit_events (firm_id, client_id, actor_id, action, entity, entity_id)
   values (''11111111-1111-1111-1111-111111111111'', ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'', ''c0000000-0000-0000-0000-000000000001'', ''INSERT'', ''clients'', ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'')',
  '42501',
  null,
  'Client Owner CANNOT insert into audit_events (throws 42501)'
);

-- Firm Staff attempting to forge actor_id (spoofing Firm Admin UUID)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "a0000000-0000-0000-0000-000000000002", "role": "authenticated"}', true);
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000002', true);

select throws_ok(
  'insert into public.audit_events (firm_id, client_id, actor_id, action, entity, entity_id)
   values (''11111111-1111-1111-1111-111111111111'', ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'', ''a0000000-0000-0000-0000-000000000001'', ''INSERT'', ''clients'', ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'')',
  '42501',
  null,
  'Firm Staff CANNOT spoof another user as actor_id in audit_events (throws 42501)'
);

-- Firm Staff attempting to insert audit event for another firm (Firm B)
select throws_ok(
  'insert into public.audit_events (firm_id, client_id, actor_id, action, entity, entity_id)
   values (''22222222-2222-2222-2222-222222222222'', ''cccccccc-cccc-cccc-cccc-cccccccccccc'', ''a0000000-0000-0000-0000-000000000002'', ''INSERT'', ''clients'', ''cccccccc-cccc-cccc-cccc-cccccccccccc'')',
  '42501',
  null,
  'Firm Staff CANNOT insert audit events for another firm (throws 42501)'
);

-- ----------------------------------------------------------------------------
-- 4. Storage Lifecycle (UPDATE / DELETE) & Path Mismatch Assertions
-- ----------------------------------------------------------------------------
-- Firm A Staff CANNOT delete storage objects (only Firm Admin or Platform Admin can delete)
select throws_ok(
  'delete from storage.objects where id = ''so111111-1111-1111-1111-111111111111''',
  '42501',
  null,
  'Firm Staff CANNOT DELETE storage objects (throws 42501)'
);

-- Client 1 Owner CANNOT delete storage objects
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "c0000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000001', true);

select throws_ok(
  'delete from storage.objects where id = ''so111111-1111-1111-1111-111111111111''',
  '42501',
  null,
  'Client Owner CANNOT DELETE storage objects (throws 42501)'
);

-- Client 1 Owner cross-firm client pairing mismatch upload attempt:
-- Uses Firm A as folder 1, but Client 3 (from Firm B) as folder 2
select throws_ok(
  'insert into storage.objects (id, bucket_id, name) values (''so111111-7777-1111-1111-111111111111''::uuid, ''documents'', ''11111111-1111-1111-1111-111111111111/cccccccc-cccc-cccc-cccc-cccccccccccc/doc_spoof/spoof.pdf'')',
  '42501',
  null,
  'Client Owner CANNOT upload with mismatched firm and client hierarchy (throws 42501)'
);

-- Firm A Admin CAN delete storage objects belonging to Firm A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "a0000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', true);

select lives_ok(
  'delete from storage.objects where id = ''so111111-9999-1111-1111-111111111111''',
  'Firm Admin CAN DELETE storage objects belonging to their firm'
);
```

---

## 5. Review Conclusion & Next Steps

| Test Suite File | Current Assertions | Critical Deficiencies | Recommended Action |
| :--- | :---: | :--- | :--- |
| `rls_tenancy_documents_purchases.test.sql` | 50 | Missing Firm B negative checks on docs/suppliers; missing SME owner boundaries on `firms`, `clients`, `invoices`, `suppliers`. | Add 10 negative assertions covering privilege escalation and cross-firm write rejections. |
| `rls_recon_sales_returns_alerts.test.sql` | 31 | Tests 14 & 16 pass vacuously due to compound joins; missing SME owner checks on `sales_invoices`, `return_drafts`, `alerts`. | Replace joins with direct PK lookups; add 8 negative assertions for SME owner & cross-firm writes. |
| `rls_rules_audit_storage.test.sql` | 58 | `rule_snapshots` is 100% unseeded and untested; storage `DELETE`/`UPDATE` unasserted; CA Admin write to rules untested; audit spoofing untested. | Add seed and 15 assertions covering `rule_snapshots`, storage lifecycle, and audit spoofing protection. |

Adopting the recommended SQL assertions will close all identified vacuous pass vulnerabilities, verify append-only statutory guarantees under all role contexts, and ensure airtight multi-tenant isolation across CA firms and SME clients.
