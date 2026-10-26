# Authentication & Access Control Smoke Test Report

**Execution Date:** 2026-10-26  
**Environment:** Local Supabase (`127.0.0.1:54321`, PostgreSQL 15, Inbucket/Mailpit `127.0.0.1:54324`)  
**Status:** ALL 10 STEPS PASSED (100% Green)

---

## 1. Test Results Matrix

| Step | Scenario | Action / Call | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **1** | Accountant Sign-up & Firm Creation | `/signup` form submission / `create_firm_with_admin` RPC | User created in `auth.users`, firm inserted in `public.firms`, caller added to `public.firm_members` with role `'admin'`, redirected to `/app`. | Firm created, admin membership verified, destination resolved to `/app`. | **PASS** |
| **2** | Invite Token Generation | `npm run dev:invite` / RPC `create_client_invite` | Generates 32-byte cryptographic random token (64 hex characters); stores SHA-256 hash in `client_invites.token_hash`. | Raw token generated and returned; plaintext never stored in database; default TTL set to 7 days. | **PASS** |
| **3** | Anonymous Invite Peeking | Unauthenticated request to `/invite/[token]` / RPC `peek_client_invite` | Returns client name, firm name, and expiration without exposing internal secrets or sensitive columns. | Returned `{ client_name: "Smoke Kirana", firm_name: "Smoke CA Practice", ... }`. | **PASS** |
| **4** | Invite Acceptance (Owner Onboarding) | Submitting email code at `/invite/[token]` / RPC `accept_client_invite` | Single-use atomic acceptance locks row `FOR UPDATE`, inserts caller into `client_access` with role `'owner'`, marks `accepted_at`, redirects to `/portal`. | User granted owner role on client; second attempt rejected with `"Invalid or expired invite token"`. | **PASS** |
| **5** | Client Owner Access Guard | Client Owner attempts direct navigation to `/app` | Route protection identifies user has no firm membership, detects `session.home === '/portal'`, and redirects to `/portal`. | User redirected to `/portal`. Access to CA accountant tools blocked. | **PASS** |
| **6** | Accountant Access Guard | CA Accountant attempts direct navigation to `/portal` | Route protection identifies user has firm membership, detects `session.home === '/app'`, and redirects to `/app`. | User redirected to `/app`. Access to owner portal redirected cleanly. | **PASS** |
| **7** | Accountant Logout | "Log out" button on `/app` layout | `supabase.auth.signOut()` clears session cookies and redirects caller to `/login`. | Session cleared; unauthenticated caller visiting `/app` redirected to `/login?next=%2Fapp`. | **PASS** |
| **8** | Client Owner Logout | "Log out" button on `/portal` layout | `supabase.auth.signOut()` clears session cookies and redirects caller to `/login`. | Session cleared; unauthenticated caller visiting `/portal` redirected to `/login?next=%2Fportal`. | **PASS** |
| **9** | Password Reset Request | Form submission at `/forgot-password` with zero enumeration | Dispatches email via Supabase Auth without disclosing whether email exists; message appears in local Inbucket/Mailpit. | Returned uniform confirmation message; email dispatched to local mail transport (`http://127.0.0.1:54324`). | **PASS** |
| **10** | Password Reset Application | Password update at `/reset-password` | Updates user password in Supabase Auth; user successfully signs in with new credentials. | User authenticated with new password; old password invalid. | **PASS** |

---

## 2. Security & Invariant Validations

1. **Zero Account Enumeration**:
   - Both `/login` (password and OTP magic code) and `/forgot-password` return generic, identical user-facing feedback regardless of whether the email is registered or not.
2. **Cryptographic Token Protection**:
   - Client invite tokens are 256-bit cryptographically secure random values generated with `extensions.gen_random_bytes(32)`.
   - The database only ever stores the hexadecimal SHA-256 digest (`token_hash`), never the plaintext token.
3. **Multi-Tenant Row-Level Security**:
   - Firm admins can only view, create, and delete invites for clients belonging to their own firm.
   - Client owners and firm staff cannot query or manipulate the `client_invites` table.
4. **Token Single-Use Guarantee**:
   - Accepting an invitation is guarded by `FOR UPDATE` row-level locking. Once `accepted_at` is stamped, any subsequent attempts to peek or accept fail immediately.
