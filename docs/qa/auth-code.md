# QA Audit Report: Authentication & Access Control (Tests & Code Health)

**Reviewer:** Reviewer R4 (Tests & Code Health Reviewer)  
**Date:** October 26, 2026  
**Audited Target:** Authentication & Access Control System (`src/lib/auth/**`, `src/tests/auth/**`, `supabase/tests/**`, `src/proxy.ts`, `src/app/(auth)/**`, `package.json`, `tsconfig.json`)  
**Scope:** Vitest Suite Quality, pgTAP Database Security Suites, TypeScript Strictness, Next.js 16 Architectural Conventions, and Dependency Hygiene.

---

## 1. Executive Summary & Audit Scorecard

This audit evaluates the test quality, code health, architectural compliance, and dependency footprint of the authentication and access control subsystem implemented for GST Saathi.

### 1.1 Executive Scorecard

| Category | Evaluation Target | Status | Metrics / Outcome |
|:---|:---|:---:|:---|
| **Vitest Test Suite** | 5 Test Suites (`signup`, `invite`, `isolation`, `session`, `redirect`) | **PASS** | 123 Auth Tests (155 Total Suite Tests) passing cleanly in 957ms. Comprehensive coverage of happy paths, edge cases, negative assertions, and malicious inputs. Zero vacuous passes. |
| **pgTAP DB Test Suite** | 4 Database Suites (`rls_invites`, `rls_tenancy`, `rls_recon`, `rls_rules`) | **PASS** | 225 Database Assertions executed and passing (0 failures). 100% transaction isolation (`begin` ... `rollback`), exact plan count matches, strict actor impersonation, and atomic security-definer function tests. |
| **TypeScript Strictness** | Full Auth Codebase (`src/lib/auth`, `src/tests/auth`, `src/app/(auth)`, `src/proxy.ts`) | **PASS** | `tsc --noEmit` exited with code 0. Zero `any` types detected in application code. Clean discriminated unions and thorough nullability handling. |
| **Next.js 16 Conventions** | `src/proxy.ts` & Authenticated Route Layouts | **PASS** | Valid Next.js 16 `proxy.ts` implementation replacing legacy middleware. `export const instant = false;` explicitly defined on dynamic authenticated layouts. |
| **Lint & Turbopack Build** | `eslint` & `next build` (Turbopack) | **PASS** | Zero ESLint warnings or errors. Production Turbopack build compiled in 1024ms, generating 17 static, dynamic, and proxy routes. |
| **Dependency Footprint** | `package.json` | **PASS** | Ultra-lean dependency footprint. Zero bloat; heavy libraries (Playwright, Lodash, Moment, Axios) completely avoided in favor of native Web/Node APIs. |

### 1.2 Overall Verdict: **FULL PASS (Ready for Production Release)**

The authentication and access control subsystem demonstrates exemplary engineering rigor. Unit tests provide deep boundary verification and anti-evasion checks, database tests enforce zero-trust multi-tenant isolation with complete transactional safety, and the code adheres strictly to TypeScript, ESLint, and Next.js 16 standards.

---

## 2. Vitest Suite Quality & Coverage Audit

The Vitest auth test suite consists of 5 dedicated test files encompassing 123 targeted unit and integration tests (out of 155 total tests in the application suite). All tests run natively in Node.js/Vitest in under 1 second.

### 2.1 Test Suite Inventory & Coverage Breakdown

```text
 ✓ src/tests/auth/signup.test.ts          32 tests  (Field validation, RPC calls, fallback provisioning, terms)
 ✓ src/tests/auth/invite.test.ts          11 tests  (Crypto hashing, TTL, single-use, owner isolation, OTP actions)
 ✓ src/tests/auth/isolation.test.ts       14 tests  (Routing, destination resolution, multi-tenant firm isolation)
 ✓ src/lib/auth/__tests__/session.test.ts 26 tests  (Session context, role guards, soft-delete handling)
 ✓ src/lib/auth/__tests__/redirect.test.ts 40 tests  (Route matrix, query params, open redirect prevention)
──────────────────────────────────────────────────────────────────────────────────────────────────────────
 Total Auth Tests:                        123 tests (100% Passing)
```

### 2.2 In-Depth Analysis of Individual Test Files

#### 1. `src/tests/auth/signup.test.ts` (32 Tests)
- **Scope**: CA / Accountant registration workflow, input validation, RPC transaction execution, and admin fallback.
- **Coverage**:
  - *Full Name Validation*: Tests missing name rejection with `{ ok: false, field: 'name' }` and asserts `auth.signUp` is not called.
  - *Email Validation*: Table-driven validation across invalid structures (`notanemail`, `missing-at-sign.com`, `user@`, `@domain.com`, `user@domain`, `spaces in@email.com`).
  - *Password Enforcement*: Boundary testing for 10-character minimum: short passwords (`''`, `'1'`, `'short'`, `'pass123'`, `'123456789'`) fail; password of exactly 10 characters succeeds.
  - *Practice / Firm Name*: Missing and whitespace-only firm names rejected.
  - *Terms Agreement*: Rejection of unaccepted states (`null`, `''`, `'off'`, `'false'`, `'0'`, `'no'`); acceptance of truthy states (`'on'`, `'true'`, `'yes'`, `'1'`).
  - *Zod Schema Parity*: Directly tests `signupSchema` with identical constraints.
  - *Happy Path Execution*: Verifies `auth.signUp` arguments, atomic execution of `create_firm_with_admin` RPC with firm name, and redirect to `/app`.
  - *Fallback Provisioning*: Verifies that if `create_firm_with_admin` fails (e.g. migration lag), fallback gracefully inserts into `firms` and `firm_members` with role `'admin'`.
  - *Negative Assertions*: Verifies failure when email already exists or when both RPC and fallback fail.

#### 2. `src/tests/auth/invite.test.ts` (11 Tests)
- **Scope**: SME client onboarding, cryptographic token handling, single-use enforcement, and OTP verification.
- **Coverage**:
  - *Cryptographic Token Format*: Asserts raw token is a 64-character lowercase hex string (generated from 32 cryptographically secure random bytes).
  - *One-Way Hashing*: Asserts the database record stores only the SHA-256 hex digest (`token_hash`) and never stores the plaintext token. Verifies `rawToken !== tokenHash`.
  - *Default TTL*: Confirms `expires_at` is stamped ~7 days into the future.
  - *Expiration Enforcement*: Invoking `peekInvite` or `acceptInvite` on an expired invite throws `'Invalid or expired invite token'`.
  - *Single-Use Enforcement*: First acceptance assigns owner access; second acceptance attempt by another user is strictly rejected.
  - *Tenant Client Isolation*: Accepting an invite grants `'owner'` role strictly on the invited client; access to other clients of the same firm is denied.
  - *Server Actions (`verifyAndAcceptInvite`, `sendInviteOtp`)*:
    - Verifies OTP verification via `auth.verifyOtp` and RPC call to `accept_client_invite`.
    - Tests input validation (missing token, email, or OTP).
    - Verifies error propagation on failed OTP or rejected invite token.

#### 3. `src/tests/auth/isolation.test.ts` (14 Tests)
- **Scope**: Multi-tenant isolation between independent CA firms, route protection, and destination resolution.
- **Coverage**:
  - *Firm Member Routing*: User with firm membership resolves `session.home === '/app'`, gets redirected to `/app` from `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/no-access`, and is granted access via `requireFirmRole('admin')`.
  - *Client Owner Routing*: User with client ownership resolves `session.home === '/portal'`, gets redirected to `/portal` from public auth routes, is blocked from accessing `/app` (redirected to `/portal`), and is blocked by `requireFirmRole`.
  - *Unassigned Users*: User without firm or client access resolves `session.home === '/no-access'`, is redirected away from `/app` and `/portal`, and is rejected by both `requireFirmRole` and `requireClientAccess`.
  - *Cross-Firm Data Isolation*:
    - Firm A member authenticated in session sees only Firm A; Firm B member sees only Firm B.
    - Firm A member attempting to access Client B1 via `requireClientAccess(clientB1Id)` is blocked and redirected to `/app`.
    - Querying `clients` table with `firm_id` filter prevents cross-firm data leaks.

#### 4. `src/lib/auth/__tests__/session.test.ts` (26 Tests)
- **Scope**: Session context resolution (`getSessionContext`), role hierarchy verification (`requireFirmRole`), and client scoping (`requireClientAccess`).
- **Coverage**:
  - *Authentication Failures*: Returns `null` on `auth.getUser` error or missing user.
  - *Role Profiles*: Correctly parses Firm Admin (`/app`), Firm Staff (`/app`), Client Owner (`/portal`), and Client Staff (`/no-access`).
  - *Name Normalization*: Falls back to `legal_name` when `trade_name` is null.
  - *Dual-Role Resolution*: When a user is both a firm member and a client owner, firm access takes precedence (`home: '/app'`).
  - *Soft-Delete Resilience*:
    - Ignores soft-deleted `firm_members` (`deleted_at !== null`).
    - Ignores soft-deleted `firms` (`deleted_at !== null`).
    - Ignores soft-deleted `client_access` (`deleted_at !== null`).
    - Ignores soft-deleted `clients` (`deleted_at !== null`).
  - *Route Guards*:
    - `requireUser`: Returns session or redirects unauthenticated visitor to `/login`.
    - `requireFirmRole`: Enforces `'admin'` vs `'staff'` hierarchy; blocks non-firm users.
    - `requireClientAccess`: Validates direct access, validates firm-ownership access, rejects cross-firm client requests, and handles parameter-less fallback.

#### 5. `src/lib/auth/__tests__/redirect.test.ts` (40 Tests)
- **Scope**: Pure functional routing evaluation (`getAuthRedirect`) and open redirect security (`validateRedirectUrl`).
- **Coverage**:
  - *Unauthenticated Matrix*: Route redirects to `/login?next=...` for protected routes (`/app`, `/portal`, `/app/purchases`, `/portal/invoices`), to `/login` for `/no-access`, and permits public routes (`/login`, `/signup`, `/terms`, `/privacy`, `/invite/...`).
  - *Authenticated Matrix*: Routes firm members to `/app`, client owners to `/portal`, and unassigned users to `/no-access`. Allows dual-access members to access both `/app` and `/portal`.
  - *Open Redirect Attack Prevention*:
    - Absolute external URLs: `https://evil.com`, `http://evil.com`, `ftp://evil.com` -> rejected, returns fallback.
    - Protocol-relative URLs: `//evil.com`, `///evil.com`, `////attacker.com/path` -> rejected.
    - Backslash evasion: `/\\evil.com`, `/\\/evil.com`, `\\evil.com` -> rejected.
    - Scheme-based script execution: `javascript:alert(1)`, `javascript:window.location=...`, `data:text/html,...`, `vbscript:msgbox(1)` -> rejected.
    - CRLF / HTTP Response Splitting: `/app\r\nSet-Cookie: evil=1`, `/portal\nLocation: https://evil.com` -> rejected.
    - Query parameter & fragment retention: `/app?tab=settings`, `/portal/invoices?period=2026-04&status=pending`, `/app#section-1` -> safely preserved.

### 2.3 Vacuous Pass & Weak Assertion Assessment

A comprehensive review of the Vitest assertions was conducted to identify any tests that might pass vacuously or offer weak coverage:
- **Zero Vacuous Passes**: Every test asserts explicit state changes, return payloads, or specific mock invocations (e.g., verifying `mockRedirect` was called with the exact expected path or asserting that `auth.signUp` was NOT invoked).
- **No Inverted Logic**: All negative assertions verify either rejected promises (`rejects.toThrow(...)`) or returned error states (`expect(result).toEqual({ ok: false, ... })`).
- **Mock Fidelity**: Mock query chains in `session.test.ts` and `isolation.test.ts` accurately replicate Supabase PostgREST chaining behavior (`.select().eq().is().maybeSingle()`).

---

## 3. pgTAP Database Test Suite & Security Enforcement

The database test suite comprises 4 SQL test suites evaluated directly against PostgreSQL 15 via the Supabase CLI (`supabase test db`).

### 3.1 Test Suite Inventory & Results

```text
/supabase/tests/rls_invites.test.sql ...................... ok (54/54 tests)
/supabase/tests/rls_recon_sales_returns_alerts.test.sql ... ok (38/38 tests)
/supabase/tests/rls_rules_audit_storage.test.sql .......... ok (73/73 tests)
/supabase/tests/rls_tenancy_documents_purchases.test.sql .. ok (60/60 tests)
────────────────────────────────────────────────────────────────────────────
Total pgTAP Database Assertions:                            225/225 PASS (100%)
Execution Time:                                             0.24 CPU seconds
```

### 3.2 Transaction Isolation & Plan Parity

- **Transaction Safety**: All 4 test files begin with `begin;` and conclude with:
  ```sql
  reset role;
  select * from finish();
  rollback;
  ```
  This guarantees that 100% of test fixtures, role switches, and mutations are rolled back cleanly, leaving zero test artifacts in the development database.
- **Plan Count Parity**: Each file declares an explicit `plan(N)` that matches the exact number of test assertions:
  - `rls_invites.test.sql`: `select plan(54);` -> exactly 54 assertions.
  - `rls_tenancy_documents_purchases.test.sql`: `select plan(60);` -> exactly 60 assertions.
  - `rls_recon_sales_returns_alerts.test.sql`: `select plan(38);` -> exactly 38 assertions.
  - `rls_rules_audit_storage.test.sql`: `select plan(73);` -> exactly 73 assertions.

### 3.3 Security-Definer Function Verification

The `rls_invites.test.sql` suite provides deep verification of critical security-definer helper functions:
1. `create_firm_with_admin(firm_name)`:
   - Throws `'Not authenticated'` (SQLSTATE `P0001`) when invoked anonymously.
   - Atomically creates firm record in `public.firms` and inserts creator into `public.firm_members` with role `'admin'`.
   - Provisions exactly 1 member for the new firm.
2. `create_client_invite(client_id, expires_in_days)`:
   - Generates a 64-hex character raw token (32 random bytes).
   - Verifies the database only stores the SHA-256 hex digest (`token_hash != rawToken`).
   - Restricts creation to CA Firm Admins managing that specific client.
   - Throws `'Permission denied'` for Firm Staff, Outsiders, or Cross-Firm Admins.
   - Throws `'Client not found'` for non-existent client IDs.
3. `peek_client_invite(p_token)`:
   - Callable by anonymous recipients.
   - Returns safe preview `{ client_name, firm_name, client_id, firm_id }` without leaking secrets.
   - Returns `null` for invalid tokens, null input, expired tokens, or already-accepted tokens.
4. `accept_client_invite(p_token)`:
   - Atomically claims the invite for the authenticated caller.
   - Enforces single-use via row locking (`FOR UPDATE`); subsequent attempts throw `'Invalid or expired invite token'`.
   - Inserts `client_access` with role `'owner'` for `auth.uid()`.
   - Stamps `accepted_at` and `accepted_by`.
   - Throws `'Not authenticated'` for anonymous callers.

### 3.4 Remediation Verification of Compound Filter Masking

In earlier database test reviews (`docs/qa/db-tests-review.md`), Tests 14 and 16 in `rls_recon_sales_returns_alerts.test.sql` were flagged for compound filter masking (joining through parent tables whose own RLS filtered out rows, thereby masking whether the child table enforced RLS).

**Audit Finding**: Inspection of `supabase/tests/rls_recon_sales_returns_alerts.test.sql` confirms that this has been **completely resolved**:
- **Test 14** (`return_drafts`):
  ```sql
  select is_empty(
    'select 1 from public.return_drafts where id = ''10000000-0000-0000-0000-000000000006''',
    'Firm B staff cannot see Firm A return_drafts'
  );
  ```
- **Test 16** (`reconciliation_results`):
  ```sql
  select is_empty(
    'select 1 from public.reconciliation_results where id = ''10000000-0000-0000-0000-000000000002''',
    'Firm B staff cannot see Firm A reconciliation_results'
  );
  ```
Both assertions now query directly by primary key without intermediate joins, ensuring RLS policies on child tables are independently and rigorously asserted.

---

## 4. Code Quality, TypeScript Strictness & Next.js 16 Architecture

### 4.1 TypeScript Strictness & Type Safety

- **Typecheck Status**: `npm run typecheck` (`tsc --noEmit`) completed with exit code 0. Zero compiler errors.
- **Compiler Options**: `strict: true`, `noImplicitAny: true`, `isolatedModules: true`, `moduleResolution: bundler`.
- **Audit for `any` Escapes**: A global regex scan across `src/lib/auth`, `src/tests/auth`, `src/app/(auth)`, and `src/proxy.ts` found **zero** uses of the TypeScript `any` keyword in application logic (the only matches were in descriptive code comments).
- **Discriminated Unions**: All server action states implement strict discriminated unions:
  ```typescript
  export type ActionResult<T = void> =
    | { ok: true; data: T }
    | { ok: false; message: string; field?: string };
  ```
- **Clean Interfaces**: Database rows and session contexts are cleanly typed via `AuthFirm`, `AuthClient`, `HomeRoute`, and `SessionContext`. Nullability is handled explicitly with optional chaining and nullish coalescing operators.

### 4.2 Next.js 16 Architectural Conventions

1. **Proxy Architecture (`src/proxy.ts`)**:
   - Next.js 16 deprecated conventional middleware patterns in favor of `src/proxy.ts`.
   - `src/proxy.ts` exports `export async function proxy(request: NextRequest)` and `export default proxy;`.
   - Properly reads and forwards request cookies using `@supabase/ssr` `getAll()` and `setAll()`.
   - Extracts session context from metadata (fast path) or queries database (standard path) to perform pure auth route redirection before hitting layout renders.
2. **Explicit Opt-Out of Static Prerendering (`instant = false`)**:
   - In Next.js 16 with Partial Prerendering (PPR) enabled, authenticated routes that depend on dynamic request cookies must opt out of static prerendering.
   - Confirmed `export const instant = false;` is explicitly defined in:
     - `src/app/(app)/app/layout.tsx`
     - `src/app/(portal)/portal/layout.tsx`
     - `src/app/(auth)/invite/[token]/page.tsx`
     - `src/app/no-access/page.tsx`
3. **Production Turbopack Build**:
   - `next build` executed cleanly without errors.
   - Build metrics:
     - Compiled successfully in 1024ms.
     - Static pages generated: 17/17 routes.
     - Generated routes cleanly separated into Static (`○`), Partial Prerender (`◐`), Dynamic (`ƒ`), and Proxy Middleware (`ƒ`).

---

## 5. Dependency Footprint & Hygiene Audit

### 5.1 Dependency Inventory

```json
{
  "dependencies": {
    "@supabase/ssr": "^0.12.7",
    "@supabase/supabase-js": "^2.118.0",
    "next": "16.4.3",
    "react": "19.3.0",
    "react-dom": "19.3.0",
    "server-only": "^0.0.1",
    "zod": "^4.6.7"
  },
  "devDependencies": {
    "@tailwindcss/turbopack": "^4",
    "@types/node": "^24.19.2",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.4.3",
    "tailwindcss": "^4",
    "typescript": "^5",
    "vitest": "^5.0.5"
  }
}
```

### 5.2 Dependency Hygiene Assessment

1. **Absence of Heavy Testing Runtimes**: Heavy, browser-based frameworks like Playwright or Cypress were avoided for backend auth testing in favor of high-speed Vitest unit mocks and native pgTAP database tests.
2. **Absence of Utility Bloat**: Lodash, Ramda, Underscore, Moment, and Axios are completely absent. The codebase relies solely on modern ES2024 features and standard Node.js/Web APIs (`crypto`, `URL`, `FormData`, `Headers`, `fetch`).
3. **Security & Validation**: Zod (`^4.6.7`) is the sole validation dependency, providing unified schema parsing on both client and server boundaries.
4. **Environment Isolation**: `server-only` is incorporated to guarantee server-exclusive code (e.g. database admin operations) is never accidentally bundled into client components.

---

## 6. Audit Checklist & Final Certification

### 6.1 Audit Verification Checklist

| # | Item / Requirement | Evaluation Result | Status |
|:---:|:---|:---|:---:|
| 1 | **Vitest Happy Path Coverage** | Complete: covers signup, invite generation, invite accept, OTP verify, routing. | **PASS** |
| 2 | **Vitest Edge Cases & Boundaries** | Complete: password lengths (9 vs 10 chars), terms truthy/falsy, name fallbacks. | **PASS** |
| 3 | **Vitest Negative Assertions** | Complete: rejects invalid emails, short passwords, missing fields, expired tokens. | **PASS** |
| 4 | **Vitest Malicious Input Protection** | Complete: open redirect evasion (`//`, `/\\`, `javascript:`, CRLF injection) tested. | **PASS** |
| 5 | **Vitest Vacuous Pass Check** | Complete: zero tautologies; all tests assert explicit return states and mock calls. | **PASS** |
| 6 | **pgTAP Transaction Isolation** | Complete: all 4 suites use `begin;` and `rollback;` with zero side effects. | **PASS** |
| 7 | **pgTAP Plan Count Parity** | Complete: plan counts exactly match assertion counts (54, 60, 38, 73 = 225 total). | **PASS** |
| 8 | **pgTAP Multi-Actor Permissions** | Complete: tests `anon`, firm admin, firm staff, client owner, outsider, platform admin. | **PASS** |
| 9 | **pgTAP Security-Definer RPCs** | Complete: tests `create_firm_with_admin`, `create_client_invite`, `peek`, `accept`. | **PASS** |
| 10 | **pgTAP Vacuous Pass Remediation** | Complete: confirmed compound join filters in tests 14 & 16 were replaced with PK queries. | **PASS** |
| 11 | **TypeScript Strictness** | Complete: `strict: true`, zero `any` types in app code, strict discriminated unions. | **PASS** |
| 12 | **ESLint Conformance** | Complete: `eslint` passes with 0 warnings and 0 errors. | **PASS** |
| 13 | **Next.js 16 `src/proxy.ts`** | Complete: complies with Next.js 16 proxy specifications for SSR cookie handling. | **PASS** |
| 14 | **Next.js 16 Dynamic Opt-Out** | Complete: `export const instant = false;` declared on authenticated route layouts. | **PASS** |
| 15 | **Production Build (`build`)** | Complete: `next build` (Turbopack) compiles cleanly in ~1s across all 17 routes. | **PASS** |
| 16 | **Lean Dependency Footprint** | Complete: zero bloat (no Playwright, Lodash, Moment); leverages native Web/Node APIs. | **PASS** |

### 6.2 Sign-Off & Certification

The GST Saathi authentication, session routing, and row-level access control implementations have passed all quality gates. The test suites are comprehensive, resilient against vacuous passes, and provide complete safety guarantees for multi-tenant data isolation.

**Certification**: **APPROVED FOR PRODUCTION INTEGRATION**  
**Auditor**: Reviewer R4 (Tests & Code Health Reviewer)
