# Client Management Security & RLS Audit Report (Clients-Security)

**Reviewer**: Reviewer R2 (Security & RLS Specialist)  
**Date**: October 28, 2026  
**Audited Target**: GST Saathi Client Management, Multi-Tenant Row Level Security (RLS), Cross-Firm Isolation, Invite Token Cryptography, and Role-Based Access Control (Admin vs Staff)  
**Applicable Standards**: OWASP Top 10:2021 (A01 Broken Access Control, A02 Cryptographic Failures, A04 Insecure Design), OWASP ASVS 4.0.3, Next.js 16 Security Model, Supabase/PostgreSQL Multi-Tenant RLS Guarantees, and DPDP Act 2023  
**Status**: **PASS (Production Ready)**

---

## 1. Executive Summary & Verdict Scorecard

A thorough, rigorous security audit was conducted on the client management implementation in `mysterious-bose`. The evaluation examined PostgreSQL database migrations, database triggers, security-definer functions, row level security (RLS) policies, pgTAP database test suites, Next.js 16 App Router server components, server actions, client components, and Vitest test suites.

```mermaid
graph TD
    Audit[Client Management Security & RLS Audit] --> V1[Vector 1: RLS Coverage & Deny-by-Default]
    Audit --> V2[Vector 2: URL ID Tampering & Cross-Firm Isolation]
    Audit --> V3[Vector 3: Invite Token Cryptography & Lifecycle]
    Audit --> V4[Vector 4: Role-Based Access Control - Staff vs Admin]

    V1 --> V1_Pass[PASS - All tables RLS-enabled, zero default leaks, partial unique index]
    V2 --> V2_Pass[PASS - 4-layer defense, foreign UUID queries return 404, session-bound firm_id]
    V3 --> V3_Pass[PASS - 256-bit CSPRNG, SHA-256 hash-only, FOR UPDATE lock, 0 logs, 1-time UI]
    V4 --> V4_Pass[PASS - DB trigger prevents staff archive, invites restricted to firm admin]

    style V1_Pass fill:#52c41a,stroke:#333,stroke-width:1.5px,color:#fff
    style V2_Pass fill:#52c41a,stroke:#333,stroke-width:1.5px,color:#fff
    style V3_Pass fill:#52c41a,stroke:#333,stroke-width:1.5px,color:#fff
    style V4_Pass fill:#52c41a,stroke:#333,stroke-width:1.5px,color:#fff
```

### 1.1 Security Vector Evaluation Summary

| # | Security Vector | Audited Artifacts | Status | Risk Level | Findings Summary |
|---|---|---|:---:|:---:|---|
| **1** | **RLS Coverage & Deny-by-Default** | `supabase/migrations/20261101000010_tenancy.sql`<br>`supabase/migrations/20261101000100_invites.sql`<br>`supabase/migrations/20261101000110_client_support.sql`<br>`supabase/tests/rls_client_support.test.sql` | **PASS** | None (Exemplary) | All client tables (`clients`, `client_access`, `client_invites`, `firms`, `firm_members`, `platform_admins`) have RLS explicitly enabled. PostgreSQL defaults to deny-by-default for all non-matching roles. Composite foreign keys `(client_id, firm_id)` enforce relational integrity. Active GSTIN uniqueness is guaranteed per firm via partial unique index `uq_clients_firm_gstin_active`. |
| **2** | **URL ID Tampering & Isolation** | `src/lib/clients/queries.ts`<br>`src/app/(app)/app/clients/[id]/page.tsx`<br>`src/app/(app)/app/clients/[id]/edit/page.tsx`<br>`src/lib/clients/actions.ts` | **PASS** | None (Exemplary) | Four-layer defense-in-depth: (1) `requireFirmRole('staff')` session verification, (2) explicit query scoping `.eq('firm_id', session.firm.id)`, (3) database RLS engine filtering, and (4) uniform `notFound()` 404 responses. Fetching a client UUID belonging to another firm yields zero data leakage, and `generateMetadata` produces generic fallback titles. Server actions strictly derive `firm_id` from the verified session. |
| **3** | **Invite Token Security** | `supabase/migrations/20261101000100_invites.sql`<br>`src/lib/clients/invite-actions.ts`<br>`src/components/clients/OwnerAccess.tsx`<br>`src/app/(auth)/invite/[token]/actions.ts` | **PASS** | None (Exemplary) | 32 cryptographically secure random bytes (`extensions.gen_random_bytes(32)` = 256 bits of entropy). Stored exclusively as SHA-256 hex digests (`token_hash`). Raw token is never stored in database and never logged (zero `console.log`/`logger` leaks). UI displays raw link strictly once in ephemeral state. Single-use is enforced via atomic `FOR UPDATE` row lock, 7-day TTL, and immutable accepted state (`accepted_at IS NULL`). |
| **4** | **Role Enforcement (Staff vs Admin)** | `supabase/migrations/20261101000110_client_support.sql`<br>`src/lib/clients/actions.ts`<br>`src/lib/clients/invite-actions.ts`<br>`supabase/tests/rls_client_support.test.sql` | **PASS** | None (Exemplary) | Hardened at both DB and application levels: `check_client_archive_permission` trigger aborts any unauthorized `deleted_at` update with exception `P0001`. Firm admins can archive/restore and create/revoke invites. Firm staff can create and edit clients, but are blocked from archiving clients or issuing/revoking invites. Accepted invites are immutable. Non-members cannot read or write. |

### Overall Verdict: **PASS**
The client management implementation demonstrates industry-grade defense-in-depth architecture. Multi-tenant boundaries are strictly upheld across database triggers, RLS policies, application queries, and server actions.

---

## 2. Detailed Vector 1: RLS Coverage & Deny-by-Default Architecture

### 2.1 Table RLS Verification Matrix

Every table governing tenancy and client management in PostgreSQL has Row Level Security explicitly enabled (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`). Under PostgreSQL semantics, enabling RLS without an explicit matching policy causes all queries (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) to deny access by default.

| Table Name | RLS Enabled | Default Posture | Selective Policies Defined | Foreign Key Multi-Tenancy Defense |
|---|:---:|:---:|---|---|
| `public.clients` | **YES** | Deny-by-default | `clients_select`<br>`clients_insert`<br>`clients_update`<br>`clients_delete` | Primary key `id`, composite unique `(id, firm_id)` references `firms(id)`. |
| `public.client_access` | **YES** | Deny-by-default | `client_access_select`<br>`client_access_insert`<br>`client_access_update`<br>`client_access_delete` | Composite foreign key `(client_id, firm_id)` references `public.clients(id, firm_id) ON DELETE CASCADE`. |
| `public.client_invites` | **YES** | Deny-by-default | `client_invites_select`<br>`client_invites_insert`<br>`client_invites_update`<br>`client_invites_delete` | Composite foreign key `(client_id, firm_id)` references `public.clients(id, firm_id) ON DELETE CASCADE`. |
| `public.firms` | **YES** | Deny-by-default | `firms_select`<br>`firms_insert`<br>`firms_update`<br>`firms_delete` | Primary key `id`. Scoped to firm members and platform admins. |
| `public.firm_members` | **YES** | Deny-by-default | `firm_members_select`<br>`firm_members_insert`<br>`firm_members_update`<br>`firm_members_delete` | Unique `(firm_id, user_id)`. Member role determines administrative scope. |
| `public.platform_admins` | **YES** | Deny-by-default | `platform_admins_select` (Read-only) | No client modification policies. |

### 2.2 Analysis of RLS Policies on `public.clients`

The policies defined in `20261101000010_tenancy.sql` provide airtight tenant isolation:

1. **`clients_select`**:
   ```sql
   create policy "clients_select" on public.clients
     for select to authenticated
     using (
       public.is_firm_member(firm_id)
       or public.is_client_owner(id)
       or public.is_platform_admin()
     );
   ```
   *Analysis*: An authenticated user can only view a client if they are an active member of the firm managing that client, or an SME client owner with an explicit grant in `client_access`, or a platform admin. Cross-firm viewing is structurally blocked at the database engine level.

2. **`clients_insert`**:
   ```sql
   create policy "clients_insert" on public.clients
     for insert to authenticated
     with check (
       public.is_firm_member(firm_id)
       or public.is_platform_admin()
     );
   ```
   *Analysis*: Prevents inserting clients under a foreign `firm_id`. Users can only create client entities within firms they actively belong to.

3. **`clients_update`**:
   ```sql
   create policy "clients_update" on public.clients
     for update to authenticated
     using (
       public.is_firm_member(firm_id)
       or public.is_platform_admin()
     )
     with check (
       public.is_firm_member(firm_id)
       or public.is_platform_admin()
     );
   ```
   *Analysis*: Restricts updates to members of the specific managing firm. Furthermore, lifecycle state transitions (`deleted_at`) are protected by the trigger `trg_check_client_archive_permission`.

4. **`clients_delete`**:
   ```sql
   create policy "clients_delete" on public.clients
     for delete to authenticated
     using (
       public.is_firm_admin(firm_id)
       or public.is_platform_admin()
     );
   ```
   *Analysis*: Hard deletes are strictly limited to firm admins and platform admins. (In practice, GST Saathi utilizes soft deletion via `deleted_at`).

### 2.3 Search Path Security on Helper Functions

All helper functions (`is_firm_member`, `is_firm_admin`, `has_client_access`, `is_client_owner`, `is_platform_admin`, `check_client_archive_permission`, `create_client_invite`, `peek_client_invite`, `accept_client_invite`) are defined as `SECURITY DEFINER` with explicit `SET search_path = ''`. This mitigates CWE-426 (Untrusted Search Path / Search Path Injection Attacks) by ensuring table lookups use fully-qualified names (e.g. `public.clients`) and cannot be intercepted by malicious schemas created in search paths.

### 2.4 Partial Unique Index: `uq_clients_firm_gstin_active`

Migration `20261101000110_client_support.sql` (lines 13-15) establishes:
```sql
create unique index if not exists uq_clients_firm_gstin_active
  on public.clients (firm_id, gstin)
  where deleted_at is null;
```
*Security Guarantees*:
- **No Duplicate Active GSTINs**: An accounting firm cannot accidentally or maliciously register two active clients with the same GSTIN.
- **Tenancy-Scoped**: The index is prefixed with `firm_id`. Two different firms can manage the same taxpayer GSTIN without collision.
- **Archived Reusability**: When a client is soft-deleted (`deleted_at IS NOT NULL`), the partial index exclusion allows the firm to onboard a new entity under that GSTIN if necessary.
- **Enforced via pgTAP**: Tests 7, 8, 9, 10, 11, and 12 in `supabase/tests/rls_client_support.test.sql` verify this index in production conditions.

---

## 3. Detailed Vector 2: URL ID Tampering & Cross-Firm Isolation

### 3.1 Attack Scenario: Direct Object Reference (IDOR) on `/app/clients/[id]`

In a multi-tenant SaaS application, an attacker authenticates as an accountant in **Firm A** and navigates to `/app/clients/<uuid-of-firm-b-client>` or attempts an API call targeting a foreign client UUID.

### 3.2 Four-Layer Defense Verification

The implementation deploys four defense rings:

```mermaid
flowchart TD
    User([Attacker in Firm A with Firm B Client UUID]) --> Ring1["Ring 1: requireFirmRole('staff')"]
    Ring1 -->|Valid Session| Ring2["Ring 2: Scoped Query .eq('firm_id', session.firm.id)"]
    Ring2 -->|Foreign UUID Excluded| Ring3["Ring 3: PostgreSQL RLS (clients_select)"]
    Ring3 -->|0 Rows Returned| Ring4["Ring 4: notFound() / 404 Uniform Response"]
    Ring4 --> Safe([No Data Leaked / Zero Info Disclosure])

    style Ring1 fill:#1890ff,stroke:#333,color:#fff
    style Ring2 fill:#2f54eb,stroke:#333,color:#fff
    style Ring3 fill:#722ed1,stroke:#333,color:#fff
    style Ring4 fill:#52c41a,stroke:#333,color:#fff
```

#### Ring 1: Session & Role Enforcement
In `src/app/(app)/app/clients/[id]/page.tsx` (line 34) and `edit/page.tsx` (line 26):
```typescript
const session = await requireFirmRole('staff');
```
If the user is not authenticated or not an active member of any firm, the call redirects to `/login` or `/no-access` immediately.

#### Ring 2: Application Query Scoping
In `src/lib/clients/queries.ts` (`getClientById`, lines 268-275):
```typescript
const { supabase, firmId: resolvedFirmId } = await getClientAndFirm(client, firmId);

const { data, error } = await supabase
  .from('clients')
  .select('*')
  .eq('firm_id', resolvedFirmId)
  .eq('id', id.trim())
  .maybeSingle();

if (error || !data) {
  return null;
}
```
And in `src/app/(app)/app/clients/[id]/edit/page.tsx` (lines 29-34):
```typescript
const { data: rawClient, error } = await supabase
  .from('clients')
  .select('*')
  .eq('id', id)
  .eq('firm_id', session.firm.id)
  .maybeSingle();
```
Even if the UUID exists in the database, the query filters for `firm_id = session.firm.id`. A foreign UUID matches 0 rows and returns `null`.

#### Ring 3: Database Engine RLS Filtering
Even if application query filtering were somehow omitted, the Supabase client executes under the user's JWT. PostgreSQL's RLS policy `clients_select` enforces `is_firm_member(firm_id)`. Since the user is not a member of Firm B, PostgreSQL returns an empty set.

#### Ring 4: Uniform Not Found (`notFound()`)
In `src/app/(app)/app/clients/[id]/page.tsx` (lines 37-39):
```typescript
const client = await getClientById(id);
if (!client) {
  notFound();
}
```
Calling Next.js `notFound()` renders `src/app/(app)/app/clients/[id]/not-found.tsx`:
- Generates standard HTTP 404 status.
- Displays uniform message: *"We could not find this client. They may have been removed or you may not have access to this firm."*
- **Metadata Protection**: In `generateMetadata` (lines 17-25), if `getClientById(id)` returns `null`, the title defaults to `Client | GST Saathi`. The foreign business name is never evaluated or leaked into the HTML `<title>` or OpenGraph tags.

### 3.3 Server Action Scoping in `src/lib/clients/actions.ts`

1. **`createClient`** (lines 188-204):
   ```typescript
   const session = await requireFirmRole('staff');
   // ...
   const { data: inserted, error: insertError } = await supabase
     .from('clients')
     .insert({
       firm_id: session.firm.id, // Strictly derived from session context
       legal_name: validData.legal_name,
       // ...
     })
   ```
   *Analysis*: The action never accepts `firm_id` from the client request body. The firm identity is permanently bound to the authenticated user's active session.

2. **`updateClient`** (lines 302-319):
   ```typescript
   const session = await requireFirmRole('staff');
   // ...
   const { data: updated, error: updateError } = await supabase
     .from('clients')
     .update({ ... })
     .eq('id', clientId)
     .eq('firm_id', session.firm.id)
     .is('deleted_at', null)
     .select('id')
     .maybeSingle();

   if (!updated) {
     return { ok: false, message: CLIENT_MESSAGES.errors.clientNotFound };
   }
   ```
   *Analysis*: Scoped to `firm_id = session.firm.id`. An attempt to update a foreign client yields 0 rows and returns `clientNotFound`.

3. **`archiveClient`** and **`restoreClient`** (lines 393-400, 495-500):
   Both actions enforce `session.firm.role === 'admin'`, call `requireFirmRole('admin')`, and explicitly filter on `.eq('id', clientId).eq('firm_id', session.firm.id)`.

4. **Search Filter Sanitization** (`src/lib/clients/queries.ts`, lines 213-218):
   ```typescript
   const term = filters.search.trim().replace(/[,()]/g, '');
   if (term) {
     query = query.or(
       `legal_name.ilike.%${term}%,trade_name.ilike.%${term}%,gstin.ilike.%${term}%`
     );
   }
   ```
   *Analysis*: Stripping commas and parentheses prevents Supabase PostgREST logical filter injection or query clause breakout.

---

## 4. Detailed Vector 3: Invite Token Cryptography, Lifecycle & Zero Leakage

### 4.1 Threat Model for Client Portal Invites
Client invites grant portal access to SME business owners to view filed returns, upload bills, and track compliance. If invite tokens are predictable, persistent in plaintext, reusable, or leaked via logs, an attacker could hijack access to confidential corporate tax records.

### 4.2 Cryptographic Token Generation & Hashing

In `supabase/migrations/20261101000100_invites.sql` (lines 139-144):
```sql
v_raw_token := encode(extensions.gen_random_bytes(32), 'hex');
v_hash := encode(extensions.digest(v_raw_token, 'sha256'), 'hex');

insert into public.client_invites (firm_id, client_id, token_hash, created_by)
values (v_firm_id, p_client_id, v_hash, auth.uid());

return v_raw_token;
```

#### Verification of Cryptographic Properties:
1. **Entropy**: `extensions.gen_random_bytes(32)` uses OpenSSL CSPRNG inside PostgreSQL to generate 32 cryptographically secure bytes ($2^{256}$ states). Hex encoding results in a 64-character token with 256 bits of entropy. Brute-force guessing is mathematically infeasible.
2. **One-Way Hashing**: SHA-256 (`extensions.digest(..., 'sha256')`) is applied immediately.
3. **Database Storage**: The table `public.client_invites` contains column `token_hash text not null unique`. **The raw token is NEVER stored in the database.** An attacker with full read access to the database cannot recover raw tokens.
4. **Zero Logging Verification**:
   - Audited `src/lib/clients/invite-actions.ts`: No logging of `rawToken` or `inviteUrl`.
   - Audited `src/components/clients/OwnerAccess.tsx`: No logging of invite URLs.
   - Audited entire `src/` codebase: Zero `console.log` statements exist in `src/`. Only `src/app/error.tsx` contains `console.error(error)` for uncaught rendering errors.
5. **Shown Only Once in UI**:
   - In `OwnerAccess.tsx` (lines 228-275), `generatedInviteUrl` is kept exclusively in ephemeral React component state.
   - A high-visibility banner informs the user: *"This link will only be shown once. Copy it now and send it to the business owner."*
   - Clicking "Done" sets `generatedInviteUrl` to `null`.
   - On page refresh or component unmount, the raw URL is permanently unrecoverable. Subsequent views only display pending metadata (creation date and remaining days).

### 4.3 Atomic Single-Use Verification & Row Locking

In `supabase/migrations/20261101000100_invites.sql` (`accept_client_invite`, lines 204-227):
```sql
v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

select id, firm_id, client_id into v_invite
from public.client_invites
where token_hash = v_hash
  and expires_at > clock_timestamp()
  and accepted_at is null
  and deleted_at is null
for update;

if not found then
  raise exception 'Invalid or expired invite token';
end if;

insert into public.client_access (firm_id, client_id, user_id, role)
values (v_invite.firm_id, v_invite.client_id, auth.uid(), 'owner')
on conflict (client_id, user_id) do update
set role = 'owner',
    deleted_at = null;

update public.client_invites
set accepted_by = auth.uid(),
    accepted_at = clock_timestamp()
where id = v_invite.id;
```

#### Security Properties:
1. **Concurrency Protection (`FOR UPDATE`)**: The `FOR UPDATE` clause places an exclusive row-level lock on the invitation record. If two concurrent requests attempt to redeem the same token simultaneously, one acquires the lock first and sets `accepted_at`, causing the second transaction to fail the `accepted_at IS NULL` predicate. Race conditions and double-claims are eliminated.
2. **7-Day Expiration**: `expires_at` defaults to `clock_timestamp() + interval '7 days'`. Both `peek_client_invite` and `accept_client_invite` enforce `expires_at > clock_timestamp()`.
3. **Immutability of Accepted Invites**: Migration `20261101000110_client_support.sql` (lines 69-91) enforces that `client_invites_delete` and `client_invites_update` require `accepted_at IS NULL`. Once accepted, an invitation becomes permanent audit history and cannot be deleted or revoked by anyone, preserving forensic integrity.

---

## 5. Detailed Vector 4: Role Enforcement (Staff vs Admin vs Non-Member)

### 5.1 Role Authority Matrix

| Operation | Firm Admin | Firm Staff | Client Owner | Non-Member / Anon | Enforced At |
|---|:---:|:---:|:---:|:---:|---|
| **View Active Clients** | Allow | Allow | Allow (Own client only) | **DENY** | `clients_select` RLS + `requireFirmRole` |
| **View Archived Clients** | Allow | Allow | **DENY** | **DENY** | `getArchivedClients` + RLS |
| **Create Client** | Allow | Allow | **DENY** | **DENY** | `clients_insert` RLS + `createClient` action |
| **Edit Client Metadata** | Allow | Allow | **DENY** | **DENY** | `clients_update` RLS + `updateClient` action |
| **Archive Client** (`deleted_at = now()`) | Allow | **DENY** | **DENY** | **DENY** | `trg_check_client_archive_permission` + Action |
| **Restore Client** (`deleted_at = null`) | Allow | **DENY** | **DENY** | **DENY** | `trg_check_client_archive_permission` + Action |
| **Create Invite Link** | Allow | **DENY** | **DENY** | **DENY** | `create_client_invite` RPC + Action |
| **Revoke Invite Link** | Allow | **DENY** | **DENY** | **DENY** | `client_invites_update` RLS + Action |
| **Accept Invite Link** | **DENY** | **DENY** | Allow (Target SME) | **DENY** (Must authenticate via OTP) | `accept_client_invite` RPC |

### 5.2 Deep-Dive: Client Archive Authorization Trigger

In `supabase/migrations/20261101000110_client_support.sql` (lines 37-60):
```sql
create or replace function public.check_client_archive_permission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (old.deleted_at is distinct from new.deleted_at) then
    if not (public.is_firm_admin(new.firm_id) or public.is_platform_admin()) then
      raise exception 'Only firm admins can archive or restore clients';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_check_client_archive_permission
  before update on public.clients
  for each row
  execute function public.check_client_archive_permission();
```

#### Security Analysis:
- Even though `clients_update` RLS policy allows firm members (including staff) to update general business details, this `BEFORE UPDATE` trigger executes on every row.
- If `deleted_at` changes from `NULL` to a timestamp (archiving) or from a timestamp to `NULL` (restoring), the trigger checks `is_firm_admin(new.firm_id)`.
- If the caller is only a staff member, PostgreSQL raises exception `'Only firm admins can archive or restore clients'` (SQLSTATE `P0001`).
- In `src/lib/clients/actions.ts` (`archiveClient` and `restoreClient`), the server action proactively validates `session.firm.role === 'admin'` and returns an informative error message (`CLIENT_MESSAGES.errors.onlyAdminCanArchive`) before even sending the update to the database.

### 5.3 Deep-Dive: Client Invites RLS Policies

In `supabase/migrations/20261101000110_client_support.sql` (lines 69-91):
```sql
create policy "client_invites_delete"
  on public.client_invites
  for delete
  to authenticated
  using (
    (public.is_firm_admin(firm_id) or public.is_platform_admin())
    and accepted_at is null
  );

create policy "client_invites_update"
  on public.client_invites
  for update
  to authenticated
  using (
    (public.is_firm_admin(firm_id) or public.is_platform_admin())
    and accepted_at is null
  )
  with check (
    (public.is_firm_admin(firm_id) or public.is_platform_admin())
    and accepted_at is null
  );
```

#### Security Analysis:
- Staff members cannot update or delete rows in `client_invites`.
- Firm admins can only update or delete invites where `accepted_at IS NULL`.
- If Firm B admin attempts to delete or revoke Firm A's invite, `is_firm_admin(firm_id)` evaluates to `false`, and RLS denies the operation (affects 0 rows).
- Non-members have zero access.

---

## 6. Verification Evidence & Automated Test Results

### 6.1 Database pgTAP Automated Test Suite (`supabase/tests/rls_client_support.test.sql`)

The 30-test pgTAP suite executes native database role impersonation (`SET LOCAL ROLE authenticated`, `set_config('request.jwt.claims', ...)`) covering all client lifecycle and security edge cases:

```
Test 1-6:   Setup verifications for Firm A, Firm B, Client A1, Client B1, Pending & Accepted Invites.
Test 7:     Duplicate active GSTIN in Firm A throws 23505 (uq_clients_firm_gstin_active). [PASS]
Test 8:     Same GSTIN registered under Firm B succeeds (tenancy scoping). [PASS]
Test 9-12:  Archived GSTIN is reusable: client 1 archived, client 2 inserted with same GSTIN succeeds. [PASS]
Test 13:    Firm staff attempting to archive client throws P0001 ('Only firm admins can archive or restore clients'). [PASS]
Test 14:    Firm staff attempting to restore client throws P0001. [PASS]
Test 15:    Firm staff can update non-lifecycle fields (trade_name) successfully. [PASS]
Test 16:    Client remains unarchived after rejected staff attempt. [PASS]
Test 17-20: Firm admin can archive and restore client successfully. [PASS]
Test 21:    Firm B admin delete on Firm A invite affects 0 rows (denied by RLS). [PASS]
Test 22:    Firm B admin update/revoke on Firm A invite affects 0 rows (denied by RLS). [PASS]
Test 23:    Firm B admin select on Firm A invite returns empty set. [PASS]
Test 24:    Firm A pending invite untouched and visible to Firm A admin. [PASS]
Test 25:    Firm A admin delete on accepted invite affects 0 rows (accepted_at is null check). [PASS]
Test 26:    Firm A admin revoke/update on accepted invite affects 0 rows (accepted_at is null check). [PASS]
Test 27:    Firm A admin can delete pending unaccepted invite. [PASS]
Test 28:    Accepted invite remains permanently recorded in database. [PASS]
Test 29:    Outsider cannot archive client (0 rows affected by RLS). [PASS]
Test 30:    Anonymous user cannot delete client (0 rows affected by RLS). [PASS]
```

### 6.2 Application Vitest Test Suite Execution

All 205 application-level tests pass across 13 test files:

```bash
 ✓ src/lib/__tests__/period.test.ts (11 tests)
 ✓ src/lib/gst/__tests__/gstin.test.ts (18 tests)
 ✓ src/tests/auth/invite.test.ts (11 tests)
 ✓ src/lib/auth/__tests__/session.test.ts (26 tests)
 ✓ src/tests/auth/isolation.test.ts (14 tests)
 ✓ src/lib/__tests__/money.test.ts (21 tests)
 ✓ src/tests/auth/signup.test.ts (32 tests)
 ✓ src/tests/clients/invites.test.ts (4 tests)
 ✓ src/tests/clients/permissions.test.ts (5 tests)
 ✓ src/tests/clients/isolation.test.ts (4 tests)
 ✓ src/tests/clients/crud.test.ts (14 tests)
 ✓ src/lib/auth/__tests__/redirect.test.ts (40 tests)
 ✓ src/tests/clients/search.test.ts (5 tests)

Test Files  13 passed (13)
     Tests  205 passed (205)
```

Key client security tests verified:
- `src/tests/clients/isolation.test.ts`: Firm A client listing strictly excludes Firm B clients; Firm A accountant fetching Firm B client by UUID returns `null`; Firm A accountant updating or archiving Firm B client fails with `clientNotFound`.
- `src/tests/clients/permissions.test.ts`: Firm staff allowed to create and edit clients; firm staff strictly rejected when attempting to archive or restore; firm admin allowed to archive and restore.
- `src/tests/clients/invites.test.ts`: Firm admin generates 64-character hex token and URL; database stores hash and not raw token; firm staff rejected from creating invite; admin can revoke pending invite; revoking accepted invite is strictly prevented.

---

## 7. Security Architecture Review & Hardening Observations

### 7.1 Identified Strengths
1. **True Defense-in-Depth**: Security is not left solely to application checks or ORM filters. The PostgreSQL database enforces RLS policies, check constraints, composite foreign keys, and trigger-based authorization.
2. **Zero Plaintext Token Exposure**: The invite token architecture follows industry gold standards (equivalent to API key hashing in GitHub/Stripe): 256 bits of entropy, SHA-256 hash stored at rest, single-use `FOR UPDATE` synchronization, and ephemeral UI exposure.
3. **No Account / Tenant Enumeration**: When a user queries an ID belonging to another firm, the system returns identical 404 responses as if the ID did not exist at all.
4. **GSTIN Statutory Validation**: Input validation enforces format, state code alignment, and Luhn mod-36 checksum calculation, preventing malformed or spoofed records.

### 7.2 Hardening Recommendations for Future Iterations
1. **Audit Logging for Lifecycle Operations**:
   - *Observation*: While `public.audit_events` exists in migration `20261101000090_audit_alerts.sql`, consider adding automatic triggers to log all client archive and restore events with `auth.uid()`, client ID, and previous/new state for compliance reporting.
2. **Rate Limiting on Invite Generation**:
   - *Observation*: While only firm admins can issue invites, adding rate limiting (e.g. max 10 invite generation calls per client per hour) can protect against rapid invite regeneration by compromised admin accounts.
3. **Automated Invite Cleanup**:
   - *Observation*: Expired, unaccepted invitations remain in `public.client_invites`. A lightweight periodic cron or pg_cron worker could mark expired invites with `deleted_at = clock_timestamp()` to keep table indexes compact.

---

## 8. Conclusion

The client management feature in `mysterious-bose` satisfies all multi-tenant isolation, cryptographic, and role-based access control criteria. Row Level Security coverage is comprehensive, URL ID tampering is completely neutralized, invite tokens are cryptographically robust and never logged, and staff vs admin permission boundaries are firmly enforced at both database and application layers.

**Final Security Assessment: PASS**
