# Authentication, Access Control & Session Lifecycle

This document defines the authentication architecture, route protection rules, session resolution lifecycle, and security guarantees for **GST Saathi**.

---

## 1. Route Map & Access Matrix

### 1.1 Public Routes
These routes are publicly accessible. Authenticated users visiting these routes may be redirected to their respective destination home:
- `/login`: Email + password authentication, or one-time email magic code.
- `/signup`: Accountant registration; automatically provisions CA firm and sets user as `admin`.
- `/forgot-password`: Request password reset email (rate-limited, no account enumeration).
- `/reset-password`: Set new password via secure Supabase token link.
- `/invite/[token]`: SME shop owner invite acceptance page.
- `/terms`: Terms of Service placeholder.
- `/privacy`: Privacy Policy placeholder.
- `/no-access`: Fallback page for authenticated users with neither firm membership nor client access.

### 1.2 Protected App Shells
- **Accountant Workspace (`/app`)**:
  - Requires active firm membership (`firm_members` role `admin` or `staff`).
  - Home route for accountants managing multiple SME clients.
- **Client Owner Portal (`/portal`)**:
  - Requires active client owner access (`client_access` role `owner`).
  - Home route for shopkeepers uploading purchase bills and viewing tax summaries.

---

## 2. Redirection & Proxy Rules

The proxy / route protection layer (`src/proxy.ts` / Next.js Proxy) enforces the following decision hierarchy:

1. **Unauthenticated Users**:
   - Accessing `/app`, `/portal`, or any sub-route:
     -> Redirect to `/login?next=<encoded_path>` (validating same-origin relative paths only).
   - Accessing public routes: Allowed.
2. **Authenticated Users**:
   - **Firm Member**:
     - Attempting to visit `/login`, `/signup`, or public auth routes:
       -> Redirect to `/app`.
     - Attempting to visit `/portal`:
       -> Permitted if also a client owner, otherwise redirected to `/app`.
   - **Client Owner**:
     - Attempting to visit `/login`, `/signup`, or public auth routes:
       -> Redirect to `/portal`.
     - Attempting to visit `/app`:
       -> Permitted if also a firm member, otherwise redirected to `/portal`.
   - **User with Neither (No Firm & No Client)**:
     - Accessing protected routes:
       -> Redirect to `/no-access`.

---

## 3. Session Context Contract

Every protected server request resolves session state through `getSessionContext()`:

```typescript
export interface AuthFirm {
  id: string;
  name: string;
  role: 'admin' | 'staff';
}

export interface AuthClient {
  id: string;
  name: string;
  role: 'owner' | 'staff';
}

export type HomeRoute = '/app' | '/portal' | '/no-access';

export interface SessionContext {
  user: User;
  firm: AuthFirm | null;
  clients: AuthClient[];
  home: HomeRoute;
}
```

---

## 4. Security & Privacy Guarantees

1. **Zero Account Enumeration**:
   - Login, password reset, and invitation submission forms display identical neutral responses regardless of whether the email is registered.
2. **Server-Side Key Isolation**:
   - The Supabase `service_role` key is strictly marked `server-only` and is never included in client-side bundles.
3. **Cryptographically Secure Invites**:
   - Invite tokens are 32+ bytes generated via cryptographic random bytes.
   - Raw tokens are never stored in the database; only SHA-256 token hashes are persisted.
   - Invites expire strictly after 7 days and are single-use.
4. **Open Redirect Defense**:
   - `next` query parameters are strictly validated: must begin with `/` and must NOT begin with `//` or `/\`. External URLs are rejected.
