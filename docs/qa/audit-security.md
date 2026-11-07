# Security Audit Report — Lane F: Application & Data Layer Security Scan

**Project:** GST Saathi  
**Audit Scope:** `src/` (Next.js 16 App Router) and `supabase/` (PostgreSQL / RLS / Storage)  
**Lane:** Lane F — Security Quick Scan & Policy Verification  
**Mode:** READ-ONLY Codebase Audit  
**Date:** November 2026  
**Status:** COMPLETE  

---

## 1. Executive Summary

This security audit conducted an in-depth defensive scan of the GST Saathi codebase across all application components (`src/`) and database migrations/policies (`supabase/`). The audit specifically evaluated six key security controls:
1. **Service-Role Import Isolation:** Verification that high-privilege administrative clients (`createAdminClient`) and service role secrets are completely absent from client bundles and browser runtimes.
2. **Server-Only Boundaries & Action Guards:** Inspection of `'server-only'` package enforcement and authorization guards (`requireUser`, `requireFirmRole`, `requireClientAccess`) on Server Actions and data access layers.
3. **Open Redirect Defenses:** Inspection of redirect routines across authentication flows, route middleware/proxies, and invite token verification.
4. **Logging & PII Protection:** Detection of sensitive data leakage (GSTIN, API keys, session tokens, passwords, raw bill text/PII) in server logs, client console output, and database audit logs.
5. **Storage Bucket Policies & Document RLS:** Comprehensive verification of private bucket configuration, path traversal defenses, tenant isolation, and pgTAP automated test suites for Supabase Storage (`storage.objects`).
6. **Invitation Token Security Lifecycle:** Analysis of SME shop owner invitation tokens, cryptographic entropy, SHA-256 one-way hashing, single-use enforcement, 7-day expiration, and security-definer SQL procedures.

### Summary of Posture

| Security Domain | Status | Risk Level | Key Observations |
| :--- | :--- | :--- | :--- |
| **1. Service-Role Isolation** | **PASS** | LOW | Admin client isolated with `'server-only'`. Zero client bundle leakage. Minor fallback secret in cleanup script to harden. |
| **2. Server Action Guards** | **PASS WITH RECOMMENDATIONS** | MEDIUM | All actions strictly enforce auth guards & Zod validation. Data access modules lack explicit `'server-only'` package imports. |
| **3. Open Redirect Defenses** | **PASS WITH FINDING** | MEDIUM | Login `next` parameter robustly validated. Action `sendInviteOtpAction` lacks regex validation on `token` before redirect interpolation. |
| **4. Logging & PII** | **PASS** | LOW | Zero passwords, API keys, or raw bill text logged. Zero account enumeration on auth forms. 13 benign console error catches. |
| **5. Storage Bucket Policies** | **PASS** | LOW | Bucket is private (`public = false`). Strict regex path layout `${firmId}/${clientId}/${documentId}`. Verified by 73 pgTAP tests. |
| **6. Invite Token Lifecycle** | **PASS** | LOW | 32-byte CSPRNG hex tokens. SHA-256 hashed in DB. Atomic single-use `SELECT ... FOR UPDATE`. 7-day expiration. |

---

## 2. Audit Scope & Methodology

The audit inspected all source code in `src/` and database migrations in `supabase/migrations/`:
- **Next.js Server Actions:** 12 files declaring `'use server'`.
- **Client Components:** 21 files declaring `'use client'`.
- **Auth & Session Management:** `src/lib/auth/*`, `src/proxy.ts`, `src/lib/supabase/*`.
- **Domain & Tenancy Operations:** `src/lib/clients/*`, `src/lib/uploads/*`, `src/lib/gst/*`.
- **Database Migrations:** Migrations `20261101000000` through `20261101000120`.
- **pgTAP Test Suites:** `supabase/tests/rls_rules_audit_storage.test.sql`, `supabase/tests/rls_invites.test.sql`, and `supabase/tests/rls_uploads.test.sql`.

---

## 3. Deep Dive: Area-by-Area Verification

### 3.1 Area 1: Service-Role Import Locations & Client Bundle Isolation

#### Locations Identified
A search for `createAdminClient`, `SUPABASE_SERVICE_ROLE_KEY`, and `service_role` across `src/` identified four primary locations:
1. **`src/lib/supabase/admin.ts`**:
   - Defines `createAdminClient<Database>()` using `env.SUPABASE_SERVICE_ROLE_KEY`.
   - **Line 1 declares `import 'server-only';`**.
   - If imported into any Client Component, the Next.js compiler halts the build with an error.
2. **`src/lib/env.ts`**:
   - Defines schema and environment resolution.
   - Specifically protects `SUPABASE_SERVICE_ROLE_KEY` with an execution check:
     ```ts
     SUPABASE_SERVICE_ROLE_KEY: isServer ? process.env.SUPABASE_SERVICE_ROLE_KEY : undefined
     ```
   - Lacks any `NEXT_PUBLIC_` prefix, preventing Next.js bundlers (Webpack/Turbopack) from inlining the secret into client-side JavaScript.
3. **`src/app/(auth)/signup/actions.ts`**:
   - Imports `createAdminClient` from `@/lib/supabase/admin`.
   - Declared as a Server Action with `'use server'` at Line 1.
   - Uses `createAdminClient` strictly as a fallback in `signupAction` if the database RPC `create_firm_with_admin` has not yet been provisioned.
4. **`src/lib/uploads/cleanup.ts`**:
   - Defines `cleanupStaleUploads()`.
   - Dynamically imports `@/lib/supabase/admin` inside `resolveAdminClient()`:
     ```ts
     const adminMod = (await import('@/lib/supabase/admin'));
     ```
   - Only imported in test files (`src/tests/uploads/access-isolation.test.ts`), never in any production runtime path or client component.

#### Client Exposure Analysis
- **Zero Client Component Exposure:** Not a single `'use client'` component imports `admin.ts`, `createAdminClient`, or `SUPABASE_SERVICE_ROLE_KEY`.
- **Build Isolation:** Next.js `'server-only'` boundary in `admin.ts` provides compile-time isolation.

#### Observation / Hardening Recommendation
In `src/lib/uploads/cleanup.ts` (lines 47–50) and local utility scripts (`scripts/dev-invite.mjs`, `scripts/dev-upload.mjs`), a hardcoded fallback string containing the Supabase default local demo key is present:
```ts
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```
While this is the standard non-secret local development key used by the Supabase CLI, fallback secrets in application code (`src/lib/uploads/cleanup.ts`) should strictly check `process.env.NODE_ENV !== 'production'` to prevent inadvertent execution against non-local environments without explicit configuration.

---

### 3.2 Area 2: Server-Only Usage & Server Action Authorization Guards

#### Server-Only Package Audit
- Currently, **only `src/lib/supabase/admin.ts`** imports the `'server-only'` package.
- **Data Access & Server Client Files:**
  - `src/lib/supabase/server.ts` uses `cookies()` from `next/headers`. While `next/headers` triggers an error if evaluated in a client bundle, it does not have an explicit `import 'server-only'`.
  - Sensitive server-only data access modules (`src/lib/clients/queries.ts`, `src/lib/uploads/queries.ts`, `src/lib/auth/session.ts`, `src/lib/auth/roles.ts`, `src/lib/auth/require-user.ts`) do NOT import `'server-only'`.

#### Server Actions Authorization Matrix
All 12 Server Action files were audited for authentication and permission checks:

| File | Server Action | Auth Guard Enforced | Parameter / Input Validation |
| :--- | :--- | :--- | :--- |
| `src/lib/clients/actions.ts` | `createClient` | `requireFirmRole('staff')` | Zod `clientFormSchema` + GSTIN checksum & regex |
| `src/lib/clients/actions.ts` | `updateClient` | `requireFirmRole('staff')` | Zod `clientFormSchema` + GSTIN checksum & regex |
| `src/lib/clients/actions.ts` | `archiveClient` | `requireFirmRole('admin')` | UUID format validation & firm tenancy check |
| `src/lib/clients/actions.ts` | `restoreClient` | `requireFirmRole('admin')` | UUID format validation & duplicate active GSTIN check |
| `src/lib/clients/invite-actions.ts` | `createClientInviteAction` | `requireFirmRole('admin')` | Non-empty UUID; database RPC checks firm admin |
| `src/lib/clients/invite-actions.ts` | `revokeClientInviteAction` | `requireFirmRole('admin')` | Non-empty UUID; verified pending and unaccepted |
| `src/lib/uploads/actions.ts` | `prepareUploads` | `requireFirmRole('staff')` OR `requireClientAccess(clientId)` | Quota check (100/hr), batch size (<=20), file size (<=10MB), MIME check, SHA-256 deduplication |
| `src/lib/uploads/actions.ts` | `confirmUpload` | `requireFirmRole('staff')` OR `requireClientAccess(clientId)` | Sniffs magic bytes via `sniffMimeType`, validates MIME, deletes storage if invalid |
| `src/lib/uploads/actions.ts` | `discardUpload` | `requireFirmRole('staff')` OR `requireClientAccess(clientId)` | Deletes storage object, marks failed |
| `src/lib/uploads/actions.ts` | `deleteDocument` | `requireFirmRole('staff')` OR `requireClientAccess(clientId)` | Verifies owning firm/client before soft-delete |
| `src/app/(auth)/login/actions.ts` | `loginWithPassword`, `sendLoginOtp`, `verifyLoginOtp` | Public entrypoint | Email/password validation, zero enumeration |
| `src/app/(auth)/invite/[token]/actions.ts` | `sendInviteOtp`, `verifyAndAcceptInvite` | Public token entrypoint | Email format, 6-digit OTP, atomic RPC `accept_client_invite` |

#### Defense-in-Depth Assessment
The Server Actions demonstrate high authorization discipline:
- Firm tenancy and role hierarchy (`admin` > `staff`) are strictly enforced at the start of every sensitive action.
- Destructive actions (archive, restore, invite creation, invite revocation) are locked to `admin`.
- Upload actions implement a multi-layer defense: quota check, batch limits, file size limits, SHA-256 duplicate detection, signed upload URLs, and post-upload magic-byte sniffing.

---

### 3.3 Area 3: Open Redirect Defenses & URL Validation

#### Redirection Logic Audit
All 18 instances of `redirect()` and `NextResponse.redirect()` were inspected.

1. **Login Redirect Parameter (`next`):**
   - Located in `src/app/(auth)/login/actions.ts` in `getValidRedirect()`:
     ```ts
     function getValidRedirect(next?: string | null): string | null {
       if (!next || typeof next !== 'string') return null;
       const trimmed = next.trim();
       if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\')) {
         return null;
       }
       try {
         const dummyOrigin = 'http://localhost';
         const parsed = new URL(trimmed, dummyOrigin);
         if (parsed.origin !== dummyOrigin) return null;
         return parsed.pathname + parsed.search + parsed.hash;
       } catch {
         return null;
       }
     }
     ```
   - **Evaluation:** Robust. Defends against:
     - Protocol-relative URLs (`//evil.com`).
     - Backslash bypasses (`/\evil.com` or `/\localhost`).
     - Absolute external schemes (`http://evil.com`, `javascript:`).
     - Returns only the parsed internal pathname, query parameters, and hash.

2. **Centralized Redirect Validation (`validateRedirectUrl`):**
   - Located in `src/lib/auth/redirect.ts`:
     - Must start with `/`.
     - Rejects `//` and `/\\`.
     - Rejects `:` prior to the first `/` (preventing scheme execution like `javascript:` or `data:`).
     - Rejects newline and control character injections (`[\r\n\0]`).

3. **Proxy / Middleware Routing (`src/proxy.ts`):**
   - Uses `getAuthRedirect(pathname, session)`.
   - Target redirects only resolve to internal application routes: `session.home` (`/app`, `/portal`, `/no-access`), `/login?next=...`, or `/login`.
   - The `next` query parameter is safely passed through `encodeURIComponent(pathname)`.

#### Vulnerability Finding: Unvalidated Token Redirection in Invite Actions
- **Location:** `src/app/(auth)/invite/[token]/actions.ts` (lines 89, 95, 98, 112, 120):
  ```ts
  export async function sendInviteOtpAction(formData: FormData): Promise<void> {
    const token = (formData.get('token') as string) || '';
    const email = (formData.get('email') as string) || '';

    if (!email || !email.includes('@')) {
      redirect(`/invite/${token}?error=${encodeURIComponent('Please enter a valid email address.')}`);
    }
    ...
  }
  ```
- **Vulnerability Mechanism:**
  `token` is extracted directly from `formData.get('token')` without format validation or URL sanitization. An attacker submitting a forged POST request to `sendInviteOtpAction` or `verifyAndAcceptInviteAction` could supply:
  - `token = "../login?error=attack"`
  - `token = "evil.com"`
  - Path traversal or malformed query string payloads.
  - While Next.js App Router keeps `redirect('/invite/' + token)` relative, unvalidated token strings interpolated directly into URL paths create path-traversal and header injection risks.
- **Remediation:**
  Validate `token` format against the known cryptographic invite token format (64-character hexadecimal) before performing any redirect:
  ```ts
  const rawToken = formData.get('token')?.toString().trim() || '';
  if (!/^[0-9a-f]{64}$/i.test(rawToken)) {
    redirect('/login');
  }
  ```

---

### 3.4 Area 4: Logging, PII & Secrets Protection

#### Console Logging Audit
A scan of all `.ts` and `.tsx` files in `src/` revealed exactly 13 occurrences of `console.error`:
1. `src/app/(app)/app/clients/error.tsx:14` — logs error boundary stack.
2. `src/app/(app)/app/clients/[id]/bills/error.tsx:14` — logs error boundary stack.
3. `src/app/(portal)/portal/bills/error.tsx:14` — logs error boundary stack.
4. `src/app/error.tsx:16` — root error boundary stack.
5. `src/app/(auth)/forgot-password/actions.ts:53` — logs Supabase auth API error message on password reset.
6. `src/app/(auth)/login/actions.ts:83` — logs routing resolution error.
7. `src/app/(auth)/login/actions.ts:162` — logs OTP dispatch error.
8. `src/app/(auth)/reset-password/actions.ts:64` — logs code exchange error.
9. `src/app/(portal)/portal/bills/page.tsx:98` — logs client detail fetch error.
10. `src/app/(portal)/portal/bills/page.tsx:184` — logs document listing query error.
11. `src/app/(portal)/portal/page.tsx:90` — logs client metadata error.
12. `src/app/(portal)/portal/page.tsx:131` — logs bill summary error.
13. `src/lib/uploads/client/useDocumentStatus.ts:330` — logs poller subscriber callback error.

#### PII & Secret Exposure Findings
- **Zero GSTIN Leakage in Logs:** GSTIN values are never printed to console logs or server stdout.
- **Zero Credential / Password Logging:** In `src/app/(auth)/login/actions.ts`, passwords and raw credentials are never logged or stored in action states.
- **Zero Raw Invite Token Logging:** In `src/lib/clients/invite-actions.ts` (line 86), raw invitation tokens are explicitly kept out of logs and only returned in the action response.
- **Zero Raw Bill Text / OCR Leakage:** Document content, OCR tokens, and extracted text are stored in designated database tables and never output to console logs.
- **Account Enumeration Defense:** Password login, magic code login, and password reset actions return identical confirmation/error messages regardless of whether the target user account exists in the database.

---

### 3.5 Area 5: Storage Policies (RLS on `storage.objects`)

#### Bucket Configuration
- **Definition:** `supabase/migrations/20261101000020_documents.sql` (lines 100–102):
  ```sql
  insert into storage.buckets (id, name, public)
  values ('documents', 'documents', false)
  on conflict (id) do nothing;
  ```
- **Privacy Assurance:** The `documents` bucket is configured with `public = false`. Public anonymous access without authentication or pre-signed tokens is completely disabled.

#### Storage Path & RLS Architecture
All document storage paths are strictly canonicalized using:
`${firm_id}/${client_id}/${document_id}`
- **Path Validation:** `src/lib/uploads/paths.ts` enforces RFC 4122 UUID validation on all three path components.
- **SQL Path Integrity & Type Safety:** In `supabase/migrations/20261101000020_documents.sql`, the RLS policies enforce:
  `name ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/'`
  This regular expression check guarantees that `(storage.foldername(name))[1]` and `(storage.foldername(name))[2]` are 36-character strings prior to casting to `::uuid`, completely preventing PostgreSQL type-cast runtime exceptions from unauthenticated path manipulation.

#### Storage RLS Policy Matrix

| Operation | Policy Name | Permitted Roles | SQL Conditions |
| :--- | :--- | :--- | :--- |
| **SELECT** | `documents_storage_select` | Firm Member, Client Owner, Platform Admin | Bucket is `documents`; matches regex; user is member of firm `folder[1]` OR verified owner of client `folder[2]` belonging to firm `folder[1]`. |
| **INSERT** | `documents_storage_insert` | Firm Member, Client Owner, Platform Admin | Bucket is `documents`; matches regex; user is member of firm `folder[1]` OR verified owner of client `folder[2]` belonging to firm `folder[1]`. |
| **UPDATE** | `documents_storage_update` | Firm Member, Platform Admin | Bucket is `documents`; user is member of firm `folder[1]`. **Client owners CANNOT mutate storage objects.** |
| **DELETE** | `documents_storage_delete` | Firm Admin, Platform Admin | Bucket is `documents`; user is admin of firm `folder[1]`. **Firm staff and client owners CANNOT delete storage objects.** |

#### Verification Test Suite
The storage policies are verified by 73 automated pgTAP tests in `supabase/tests/rls_rules_audit_storage.test.sql`:
- Line 722: Asserts Firm Staff **cannot delete** storage objects (throws SQLSTATE `42501`).
- Line 735: Asserts Client Owners **cannot delete** storage objects (throws SQLSTATE `42501`).
- Line 744: Asserts Client Owners **cannot upload with mismatched firm/client pairing** (throws SQLSTATE `42501`).

#### Upload Pipeline Security Controls
1. **Quota Rate Limiting:** RPC `check_upload_quota` enforces a statutory ceiling of 100 uploads per client per hour.
2. **Batch Limit:** Server action `prepareUploads` enforces a maximum of 20 files per request.
3. **File Size Limit:** Maximum 10 MB (`MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024`).
4. **MIME & Magic Byte Sniffing:** Two-stage verification:
   - Client MIME validation during `prepareUploads`.
   - Post-upload binary header sniffing in `confirmUpload` using `sniffMimeType` (`Buffer.from(arrayBuffer)`), verifying file headers for PNG (`89 50 4E 47`), JPEG (`FF D8 FF`), and PDF (`25 50 44 46 2D`). Spoofed files (e.g. executable binaries or HTML scripts with `.pdf` extensions) are automatically deleted from storage and marked failed.
5. **Stale Upload Purge:** `cleanup_stale_uploads` automatically soft-deletes and removes abandoned files older than 1 hour.

---

### 3.6 Area 6: Client Invitation Token Security Lifecycle

#### Token Generation & Entropy
- **RPC:** `public.create_client_invite(p_client_id uuid)` in `supabase/migrations/20261101000100_invites.sql`.
- **Entropy Source:** `extensions.gen_random_bytes(32)`.
  - 32 cryptographically secure random bytes = 256 bits of entropy.
  - Hex-encoded into a 64-character lowercase token (`v_raw_token`).
  - Brute-force complexity of $2^{256}$, rendering guessing attacks computationally infeasible.

#### One-Way Hashing & Database Storage
- **Cryptographic Hashing:**
  ```sql
  v_hash := encode(extensions.digest(v_raw_token, 'sha256'), 'hex');
  ```
- **Storage Protection:**
  - Only `token_hash` is inserted into `public.client_invites`.
  - The raw plaintext token is **never stored in the database**.
  - A database breach or snapshot leak would not reveal valid invitation tokens.
  - Uniqueness is enforced by database constraint `token_hash text not null unique`.

#### Expiration Enforcement
- **Default Lifetime:** 7 days (`expires_at timestamptz not null default (clock_timestamp() + interval '7 days')`).
- **Query Verification:** Both `peek_client_invite` and `accept_client_invite` enforce `expires_at > clock_timestamp()` in SQL.

#### Single-Use & Concurrency Protection
- **Atomic Acceptance:** In `accept_client_invite(p_token text)`:
  ```sql
  select id, firm_id, client_id into v_invite
  from public.client_invites
  where token_hash = v_hash
    and expires_at > clock_timestamp()
    and accepted_at is null
    and deleted_at is null
  for update;
  ```
  - `FOR UPDATE` row lock prevents race conditions or concurrent multi-acceptance.
  - Acceptance stamps `accepted_by = auth.uid()` and `accepted_at = clock_timestamp()`.
  - Subsequent invocations with the same token fail immediately with `'Invalid or expired invite token'`.

#### Security-Definer & Execution Isolation
- Procedures `create_client_invite`, `peek_client_invite`, and `accept_client_invite` are configured with `security definer` and `set search_path = ''`.
- Fully qualified table references (`public.client_invites`, `auth.uid()`, `extensions.digest`) prevent search_path injection attacks.

#### Invitation Grant Anomaly
In `supabase/migrations/20261101000100_invites.sql` (line 235):
```sql
grant execute on function public.create_client_invite(uuid) to authenticated, anon;
```
While the body of `create_client_invite` checks `is_firm_admin(v_firm_id)` and raises `'Permission denied'` for unauthenticated users, granting execute privilege on this administrative function to the `anon` PostgreSQL role is unnecessary attack surface.

---

## 4. Comprehensive Findings & Remediations Matrix

| ID | Category | Severity | Description | Remediation Plan |
| :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | Open Redirect | **MEDIUM** | In `src/app/(auth)/invite/[token]/actions.ts`, `token` is taken directly from `formData.get('token')` without regex validation before being used in `redirect('/invite/' + token)`. | Validate that `token` matches `/^[0-9a-f]{64}$/i` before redirecting. If invalid, redirect to `/login`. |
| **SEC-02** | Server-Only Guards | **LOW** | Sensitive server data access modules (`src/lib/supabase/server.ts`, `src/lib/clients/queries.ts`, `src/lib/uploads/queries.ts`, `src/lib/auth/session.ts`) do not import `'server-only'`. | Add `import 'server-only';` at the top of these modules for compile-time bundling protection. |
| **SEC-03** | Hardcoded Dev Key | **LOW** | `src/lib/uploads/cleanup.ts` (line 49) contains a hardcoded fallback Supabase local service key string. | Enforce that fallback keys are strictly disabled when `NODE_ENV === 'production'`. |
| **SEC-04** | SQL Permissions | **LOW** | `create_client_invite` is granted to the `anon` role in Migration 100, although only firm admins are authorized inside the function. | Revoke execute privilege on `create_client_invite` from `anon`: `revoke execute on function public.create_client_invite(uuid) from anon;`. |
| **SEC-05** | Fallback Auth Bypass | **INFO** | In `src/proxy.ts` (lines 103–110), demo mock session injection occurs when `isDemoMode` is true (including placeholder URLs). | Ensure production CI/CD environment checks assert `NEXT_PUBLIC_DEMO_MODE !== 'true'` and valid Supabase production endpoints. |

---

## 5. Security Checklist & Compliance Sign-off

- [x] **Service-role key isolated from client components:** VERIFIED (guarded with `'server-only'`).
- [x] **Server actions properly authenticated:** VERIFIED (`requireFirmRole`, `requireClientAccess`).
- [x] **Login redirect protected against open redirects:** VERIFIED (`getValidRedirect` checks origin and relative path).
- [x] **Invite redirect protected against open redirects:** AUDITED (Finding SEC-01 documented).
- [x] **Zero logging of passwords, tokens, GSTINs, or PII:** VERIFIED (audit log tables and console sanitized).
- [x] **Storage bucket configured private:** VERIFIED (`documents` bucket `public = false`).
- [x] **Storage RLS path isolation enforced:** VERIFIED (`${firmId}/${clientId}/${documentId}` + pgTAP tests).
- [x] **Invite tokens hashed with SHA-256:** VERIFIED (256-bit entropy, single-use, 7-day expiry).
- [x] **Statutory audit ledger append-only:** VERIFIED (`prevent_audit_modification()` trigger).

---
*End of Report — Lane F Project Audit*
