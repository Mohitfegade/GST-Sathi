# Next.js 16 Prerender & Unstable Values Audit Report

**Author / Auditor:** Lane B (Next16 App Auditor)  
**Target Codebase:** mysterious-bose (GST Saathi)  
**Date:** October 28, 2026  
**Artifact File:** `docs/qa/next16-audit.md`  
**Execution Environment:** Next.js 16.4.3 (Turbopack, App Router, `cacheComponents: true`, `partialPrefetching: true`), React 19.3.0  
**Audit Scope:** All layouts, pages, loading skeletons, error boundaries, metadata route handlers, and data query layers under `src/app` and `src/lib`  
**Overall Verdict:** **CRITICAL REMEDIATION REQUIRED** (4 production routes + 1 metadata handler blocked by synchronous IO / clock access during prerender)

---

## 1. Executive Summary & Audit Scorecard

Next.js 16 with `cacheComponents: true` (configured in `next.config.ts`) introduces strict compile-time and prerender-time validation for **Instant Navigation** and **Partial Prerendering (PPR)**. Under this architecture, Next.js instruments the Node.js runtime environment via `next/dist/server/node-environment-extensions/`, intercepting synchronous access to the system clock (`Date.now()`, `new Date()`, `Date()`), pseudo-random number generators (`Math.random()`), and cryptographic entropy (`crypto.randomUUID()`, `crypto.getRandomValues()`).

When any of these APIs are evaluated during static generation, prerender analysis, or the static shell phase outside of a `<Suspense>` boundary (or without an explicit `await connection()`), Next.js immediately aborts the render pass and throws a fatal compile-time or runtime blocking error:
- `blocking-prerender-current-time`: `Route "<route>": Next.js encountered the unstable value \`new Date()\` while prerendering.`
- `blocking-prerender-runtime`: `Next.js encountered runtime data during prerendering: cookies()`
- `blocking-prerender-random`: `Next.js encountered the unstable value \`Math.random()\` while prerendering.`
- `blocking-prerender-crypto`: `Next.js encountered the unstable value \`crypto.randomUUID()\` while prerendering.`

### Critical Architectural Finding: `instant = false` vs Synchronous IO
A crucial distinction documented in Next.js 16 migration guides:
> **`export const instant = false;`** marks a route segment as allowed to block on **Request-time APIs** (e.g. `cookies()`, `headers()`, uncached dynamic `fetch`).  
> **It does NOT clear synchronous IO errors.** Calls like `new Date()`, `Date.now()`, `Math.random()`, and `crypto.randomUUID()` **still throw fatal prerender build errors** even when `instant = false` is declared.

### Comprehensive Route Scorecard

| Route Segment / File | Component Type | Runtime APIs (`cookies`, session) | Unstable Value Calls (`Date`, `Math`, `UUID`) | `instant = false` Present? | Next.js 16 Blocking Status | Verdict |
|---|---|:---:|:---:|:---:|---|:---:|
| **`src/app/(portal)/portal/bills/page.tsx`** | Server Component | Yes (`requireClientAccess`, `createServerClient`) | **YES** (Direct `new Date()` at line 103) | **NO** | `blocking-prerender-current-time`<br>`blocking-prerender-runtime` | **CRITICAL FAIL** |
| **`src/app/(portal)/portal/page.tsx`** | Server Component | Yes (`requireClientAccess`, `createServerClient`) | None (deterministic `new Date(isoString)` only) | **NO** (Missing) | `blocking-prerender-runtime` (`cookies()`) | **FAIL** |
| **`src/app/(portal)/portal/layout.tsx`** | Server Layout | Yes (`requireClientAccess`) | None | Yes | Allowed to block (safe during migration) | **PASS** |
| **`src/app/(portal)/portal/bills/loading.tsx`** | Client Skeleton | None | None | N/A | Static skeleton | **PASS** |
| **`src/app/(portal)/portal/bills/error.tsx`** | Client Error Boundary | None | None | N/A | Client component | **PASS** |
| **`src/app/(app)/app/clients/page.tsx`** | Server Component | Yes (`requireFirmRole`, `createServerClient`) | **YES** (Indirect `new Date().toISOString()` in `listClients` -> `enrichClientsWithDetails`) | Yes (Line 13) | `blocking-prerender-current-time` (`enrichClientsWithDetails`) | **CRITICAL FAIL** |
| **`src/app/(app)/app/clients/[id]/page.tsx`** | Server Component + `generateMetadata` | Yes (`requireFirmRole`, `createServerClient`) | **YES** (Indirect `new Date().toISOString()` in `getClientById` -> `enrichClientsWithDetails`) | Yes (Line 11) | `blocking-prerender-current-time` in page and `generateMetadata` | **CRITICAL FAIL** |
| **`src/app/(app)/app/clients/[id]/bills/page.tsx`** | Server Component + `generateMetadata` | Yes (`requireFirmRole`, `createServerClient`) | **YES** (Indirect `new Date().toISOString()` in `getClientById` -> `enrichClientsWithDetails`) | Yes (Line 15) | `blocking-prerender-current-time` in page and `generateMetadata` | **CRITICAL FAIL** |
| **`src/app/(app)/app/clients/[id]/edit/page.tsx`** | Server Component | Yes (`requireFirmRole`, `createServerClient`) | None (Queries raw table, bypasses `enrichClientsWithDetails`) | Yes (Line 13) | Allowed to block (safe during migration) | **PASS** |
| **`src/app/(app)/app/clients/new/page.tsx`** | Server Component | Yes (`requireFirmRole`) | None | Yes (Line 7) | Allowed to block (safe during migration) | **PASS** |
| **`src/app/(app)/app/page.tsx`** | Server Component | Yes (`requireFirmRole`, `getClientCounts`) | None (`getClientCounts` uses SQL count, no `Date`) | Yes (Line 6) | Allowed to block (safe during migration) | **PASS** |
| **`src/app/(app)/app/layout.tsx`** | Server Layout | Yes (`requireFirmRole`) | None | Yes (Line 7) | Allowed to block (safe during migration) | **PASS** |
| **`src/app/(app)/app/clients/loading.tsx`** | Client Skeleton | None | None | N/A | Static skeleton | **PASS** |
| **`src/app/(app)/app/clients/error.tsx`** | Client Error Boundary | None | None | N/A | Client component | **PASS** |
| **`src/app/(app)/app/clients/[id]/loading.tsx`** | Client Skeleton | None | None | N/A | Static skeleton | **PASS** |
| **`src/app/(app)/app/clients/[id]/not-found.tsx`** | Server Component | None | None | N/A | Static 404 | **PASS** |
| **`src/app/(app)/app/clients/[id]/bills/loading.tsx`** | Client Skeleton | None | None | N/A | Static skeleton | **PASS** |
| **`src/app/(app)/app/clients/[id]/bills/error.tsx`** | Client Error Boundary | None | None | N/A | Client component | **PASS** |
| **`src/app/(auth)/login/page.tsx`** | Client Component (`'use client'`) | Reads URL via `useSearchParams` | None | N/A | Wrapped in `<Suspense fallback={...}>` | **PASS** |
| **`src/app/(auth)/signup/page.tsx`** | Client Component (`'use client'`) | None | None | N/A | Form actions only | **PASS** |
| **`src/app/(auth)/invite/[token]/page.tsx`** | Server Component | Yes (`createClient` / `cookies`) | None | Yes (Line 25) | Allowed to block (safe during migration) | **PASS** |
| **`src/app/(auth)/forgot-password/page.tsx`** | Client Component (`'use client'`) | None | None | N/A | Form actions only | **PASS** |
| **`src/app/(auth)/reset-password/page.tsx`** | Client Component (`'use client'`) | Reads URL via `useSearchParams` | None | N/A | Wrapped in `<Suspense fallback={...}>` | **PASS** |
| **`src/app/page.tsx` (Landing)** | Server Component | None | None (uses hardcoded `currentYear = 2026`) | N/A | Completely static prerender | **PASS** |
| **`src/app/layout.tsx` (Root Layout)** | Server Layout | None | None | N/A | Static shell | **PASS** |
| **`src/app/not-found.tsx`** | Server Component | None | None | N/A | Static 404 | **PASS** |
| **`src/app/error.tsx`** | Client Error Boundary | None | None | N/A | Client component | **PASS** |
| **`src/app/sitemap.ts`** | Metadata Handler (`/sitemap.xml`) | None | **YES** (Direct `lastModified: new Date()` at line 10) | N/A | `blocking-prerender-current-time` | **CRITICAL FAIL** |
| **`src/app/robots.ts`** | Metadata Handler (`/robots.txt`) | None | None | N/A | Static robots configuration | **PASS** |
| **`src/app/no-access/page.tsx`** | Server Component | None in render (only in Server Action) | None | Yes (Line 5) | Allowed to block (safe during migration) | **PASS** |
| **`src/app/privacy/page.tsx`** | Server Component | None | None (Hardcoded text date) | N/A | Static prerender | **PASS** |
| **`src/app/terms/page.tsx`** | Server Component | None | None (Hardcoded text date) | N/A | Static prerender | **PASS** |
| **`src/app/icon.tsx`** | Route Handler (`ImageResponse`) | None | None | N/A | Static PNG generation | **PASS** |

---

## 2. Next.js 16 Runtime Architecture & Interception Mechanism

To understand why these failures occur, the exact interception mechanism was extracted from `next@16.4.3`:

### 2.1 The `node-environment-extensions` Layer
When `cacheComponents: true` is configured in `next.config.ts`, Next.js installs monkey-patches in `node_modules/next/dist/server/node-environment-extensions/`:
1. **`date.js`**:
   ```javascript
   function createDate(originalConstructor) {
     const newConstructor = function Date1() {
       if (arguments.length === 0) {
         io('`new Date()`', 'time');
       }
       return construct(originalConstructor, arguments, new.target);
     };
     // Also intercepts Date.now() and Date()
   }
   ```
2. **`random.js`**: Intercepts `Math.random()` and calls `io('`Math.random()`', 'random')`.
3. **`web-crypto.js`**: Intercepts `crypto.randomUUID()` and calls `io('`crypto.randomUUID()`', 'crypto')`.

### 2.2 The `io-utils.js` Abort Controller
Inside `io(expression, type)` (`node_modules/next/dist/server/node-environment-extensions/io-utils.js`), the active React work unit store is checked:
- If `workUnitStore.type === 'prerender'` or `'prerender-runtime'` or `'prerender-client'`:
  It immediately calls:
  ```javascript
  abortOnSynchronousPlatformIOAccess(
    workStore.route,
    expression,
    applyOwnerStack(createSyncIOError(workStore.route, expression, type)),
    workUnitStore
  );
  ```
- If `workUnitStore.type === 'request'` during static shell staging:
  It calls `stageController.syncInterruptCurrentStageWithReason(syncIOError)` and aborts the prerender controller.

### 2.3 Why `export const instant = false;` Does Not Fix Clock Access
The Next.js 16 documentation (`01-app/02-guides/migrating-to-cache-components.md`, lines 101–103) explicitly warns:
> *"Calls like `new Date()`, `Date.now()`, `Math.random()`, and `crypto.randomUUID()` during prerender throw a build error that `instant = false` does not clear, so a route that uses them won't build until you address it, opt-out or not. Move the call out of the prerendered shell so it runs at request time: wrap the part that needs it in `<Suspense>` and call `connection()` before the call, or move it into a Client Component."*

---

## 3. Deep-Dive Audit: Critical Blocking Locations

### 3.1 `src/app/(portal)/portal/bills/page.tsx`
* **Trigger Category:** Direct Synchronous IO Call (`new Date()`) + Unopted Runtime API (`cookies()`)
* **Exact Code Location:**
  [src/app/(portal)/portal/bills/page.tsx#L102-L133](file:///c:/Users/Mohit/Documents/antigravity/mysterious-bose/src/app/(portal)/portal/bills/page.tsx#L102-L133)
  ```tsx
  // Line 102-106:
  // 2. Month selector defaults to current month in MMYYYY format (e.g. October 2026 -> "102026")
  const now = new Date(); // <--- 0-argument new Date() accesses system clock!
  const currentMonthNum = now.getMonth() + 1;
  const currentYearNum = now.getFullYear();
  const defaultMonthFp = formatFp(currentMonthNum, currentYearNum);
  
  // Line 116-118:
  for (let i = 0; i < 12; i++) {
    const d = new Date(currentYearNum, currentMonthNum - 1 - i, 1);
    ...
  }
  ```
* **Call Trace:**
  1. Next.js prerender initiates for route `/(portal)/portal/bills`.
  2. `OwnerBillsPage` renders as a Server Component.
  3. Execution reaches line 103: `new Date()`.
  4. Node environment extension `date.js` intercepts the 0-argument constructor.
  5. `_ioutils.io('`new Date()`', 'time')` is triggered.
  6. Controller aborts with:
     ```text
     Route "/(portal)/portal/bills": Next.js encountered the unstable value `new Date()` while prerendering.
     Learn more: https://nextjs.org/docs/messages/blocking-prerender-current-time
     ```
* **Secondary Defect:** The file is also missing `export const instant = false;` (unlike `layout.tsx`), meaning its calls to `requireClientAccess()` (line 41) and `createServerClient()` (line 60) will trigger `blocking-prerender-runtime` during instant navigation validation.

---

### 3.2 `src/app/(app)/app/clients/page.tsx`
* **Trigger Category:** Indirect Synchronous IO Call (`new Date()`) inside Data Query Layer
* **Exact Code Location:**
  - Route caller: [src/app/(app)/app/clients/page.tsx#L62](file:///c:/Users/Mohit/Documents/antigravity/mysterious-bose/src/app/(app)/app/clients/page.tsx#L62) -> `await listClients(filters)`
  - Query implementation: [src/lib/clients/queries.ts#L101-L117](file:///c:/Users/Mohit/Documents/antigravity/mysterious-bose/src/lib/clients/queries.ts#L101-L117)
  ```ts
  // In src/lib/clients/queries.ts:
  async function enrichClientsWithDetails(
    clients: ClientRow[],
    supabase: SupabaseClient<Database>
  ): Promise<ClientListItem[]> {
    if (clients.length === 0) return [];
  
    const clientIds = clients.map((c) => c.id);
    const nowIso = new Date().toISOString(); // <--- 0-argument new Date() called during render!
  
    const [ownersRes, invitesRes, periodsRes, docsRes] = await Promise.all([
      ...
      supabase
        .from('client_invites')
        .select('client_id')
        .in('client_id', clientIds)
        .is('accepted_at', null)
        .is('deleted_at', null)
        .gt('expires_at', nowIso), // <--- Uses nowIso to filter unexpired invites
      ...
    ]);
  ```
* **Call Trace:**
  1. Next.js prerender evaluates `ClientsPage` (`/(app)/app/clients`).
  2. While `instant = false` is present on line 13, prerender still runs the component body.
  3. Line 62 invokes `listClients(filters)`.
  4. `listClients` invokes `enrichClientsWithDetails(rawClients, supabase)` on line 234.
  5. Line 101 executes `new Date().toISOString()`.
  6. Intercepted by `date.js` -> aborts prerender with `blocking-prerender-current-time`.
  7. `instant = false` cannot defer this error because it is a synchronous platform IO access.

---

### 3.3 `src/app/(app)/app/clients/[id]/page.tsx`
* **Trigger Category:** Indirect Synchronous IO Call in Server Component AND `generateMetadata`
* **Exact Code Location:**
  - `generateMetadata`: [src/app/(app)/app/clients/[id]/page.tsx#L19](file:///c:/Users/Mohit/Documents/antigravity/mysterious-bose/src/app/(app)/app/clients/[id]/page.tsx#L19) -> `await getClientById(id)`
  - Page Component: [src/app/(app)/app/clients/[id]/page.tsx#L36](file:///c:/Users/Mohit/Documents/antigravity/mysterious-bose/src/app/(app)/app/clients/[id]/page.tsx#L36) -> `await getClientById(id)`
  - Query implementation: [src/lib/clients/queries.ts#L281](file:///c:/Users/Mohit/Documents/antigravity/mysterious-bose/src/lib/clients/queries.ts#L281)
  ```ts
  // In src/lib/clients/queries.ts:
  export async function getClientById(...) {
    ...
    const [enriched] = await enrichClientsWithDetails([data], supabase);
    return enriched ?? null;
  }
  ```
* **Call Trace:**
  1. Next.js prerender evaluates `generateMetadata` for dynamic route segment `/(app)/app/clients/[id]`.
  2. `getClientById(id)` executes, calling `enrichClientsWithDetails`.
  3. Line 101 executes `new Date().toISOString()`.
  4. Prerender aborts with `blocking-prerender-current-time`.
  5. Furthermore, if `generateMetadata` were bypassed, the page component itself executes the exact same call at line 36.

---

### 3.4 `src/app/(app)/app/clients/[id]/bills/page.tsx`
* **Trigger Category:** Indirect Synchronous IO Call in Server Component AND `generateMetadata`
* **Exact Code Location:**
  - `generateMetadata`: [src/app/(app)/app/clients/[id]/bills/page.tsx#L23](file:///c:/Users/Mohit/Documents/antigravity/mysterious-bose/src/app/(app)/app/clients/[id]/bills/page.tsx#L23) -> `await getClientById(id)`
  - Page Component: [src/app/(app)/app/clients/[id]/bills/page.tsx#L46](file:///c:/Users/Mohit/Documents/antigravity/mysterious-bose/src/app/(app)/app/clients/[id]/bills/page.tsx#L46) -> `await getClientById(id)`
* **Call Trace:**
  1. Exactly matches 3.3 above: both `generateMetadata` and `ClientBillsPage` call `getClientById(id)`.
  2. `getClientById` delegates to `enrichClientsWithDetails`, triggering `new Date().toISOString()`.
  3. Fails prerender with `blocking-prerender-current-time`.

---

### 3.5 `src/app/sitemap.ts`
* **Trigger Category:** Direct Synchronous IO Call in Metadata Route Handler
* **Exact Code Location:**
  [src/app/sitemap.ts#L10](file:///c:/Users/Mohit/Documents/antigravity/mysterious-bose/src/app/sitemap.ts#L10)
  ```ts
  export default function sitemap(): MetadataRoute.Sitemap {
    const baseUrl = siteConfig.url;
  
    return [
      {
        url: baseUrl,
        lastModified: new Date(), // <--- 0-argument new Date() in sitemap generation!
      },
    ];
  }
  ```
* **Call Trace:**
  1. Static generation compiles `/sitemap.xml`.
  2. `sitemap()` executes on the server.
  3. Line 10 instantiates `new Date()`.
  4. Triggers `(0, _ioutils.io)('`new Date()`', 'time')`.
  5. Route `/sitemap.xml` fails static prerender with `blocking-prerender-current-time`.

---

### 3.6 `src/app/(portal)/portal/page.tsx`
* **Trigger Category:** Missing Segment Opt-Out for Request-Time APIs
* **Exact Code Location:**
  [src/app/(portal)/portal/page.tsx#L30](file:///c:/Users/Mohit/Documents/antigravity/mysterious-bose/src/app/(portal)/portal/page.tsx#L30) and [line 52](file:///c:/Users/Mohit/Documents/antigravity/mysterious-bose/src/app/(portal)/portal/page.tsx#L52)
  ```tsx
  export default async function PortalPage({ searchParams }: PortalPageProps) {
    const session = await requireClientAccess(); // <--- calls cookies()
    ...
    const supabase = await createServerClient<Database>(); // <--- calls cookies()
  ```
* **Finding:** While `src/app/(portal)/portal/layout.tsx` declares `export const instant = false;`, Next.js 16 segment validation does **not** treat `instant = false` as cascading to all page descendants by default. `portal/page.tsx` lacks `export const instant = false;`.
* **Error:** During instant navigation validation, Next.js flags this route with `blocking-prerender-runtime` because `cookies()` is evaluated outside `<Suspense>`.

---

## 4. Audit of Auth Pages & Public Routes

### 4.1 Client Auth Pages (`/login`, `/signup`, `/forgot-password`, `/reset-password`)
All public authentication pages were examined:
1. **`/login` (`src/app/(auth)/login/page.tsx`):**
   - Declared as `'use client'`.
   - Uses `useSearchParams()` to retrieve `next`.
   - **Correctly wrapped:** `LoginPage` default export wraps `<LoginForm />` inside `<Suspense fallback={...}>` (lines 369–382). This conforms to Next.js 16 requirements for Client Components consuming URL data.
   - **Verdict: PASS**.
2. **`/signup` (`src/app/(auth)/signup/page.tsx`):**
   - Declared as `'use client'`.
   - Uses React 19 `useActionState` and Server Action `signUpAction`.
   - No `useSearchParams`, no clock access during render.
   - **Verdict: PASS**.
3. **`/forgot-password` (`src/app/(auth)/forgot-password/page.tsx`):**
   - Declared as `'use client'`.
   - Standard form submission via `useActionState`.
   - **Verdict: PASS**.
4. **`/reset-password` (`src/app/(auth)/reset-password/page.tsx`):**
   - Declared as `'use client'`.
   - Uses `useSearchParams()` to read `?code=`.
   - **Correctly wrapped:** `ResetPasswordPage` default export wraps `<ResetPasswordForm />` inside `<Suspense fallback={...}>` (lines 146–160).
   - **Verdict: PASS**.

### 4.2 `/invite/[token]` (`src/app/(auth)/invite/[token]/page.tsx`)
- Server Component that awaits `params` (`{ token } = await params`) and `searchParams`.
- Calls `createClient()` which accesses `cookies()`, and calls RPC `peek_client_invite`.
- Line 25 explicitly declares `export const instant = false;`.
- No calls to `new Date()`, `Date.now()`, `Math.random()`, or `crypto.randomUUID()`.
- **Verdict: PASS** (Compliant under incremental adoption).

### 4.3 Root Landing Page & Marketing Pages
- **`src/app/page.tsx`**: Completely static Server Component. It renders `Header`, `Hero`, `Problem`, `HowItWorks`, `WhatItChecks`, `Audience`, `FinalCta`, and `Footer`.
  - Notice in [src/components/layout/Footer.tsx#L7](file:///c:/Users/Mohit/Documents/antigravity/mysterious-bose/src/components/layout/Footer.tsx#L7):
    ```ts
    const currentYear = 2026; // Hardcoded static year avoids new Date().getFullYear()!
    ```
  - Excellent compliance pattern.
  - **Verdict: PASS**.
- **`src/app/privacy/page.tsx` & `src/app/terms/page.tsx`**: Static Server Components with hardcoded string dates (`Effective Date: October 26, 2026`).
  - **Verdict: PASS**.
- **`src/app/robots.ts` & `src/app/icon.tsx`**: Static routes without runtime dependencies.
  - **Verdict: PASS**.

---

## 5. Audit of Shared Libraries & Query Infrastructure

### 5.1 `src/lib/auth/session.ts` & `src/lib/auth/roles.ts`
- Functions: `getSessionContext()`, `requireFirmRole()`, `requireClientAccess()`, `requireUser()`.
- **Behavior:**
  - All resolve cookies asynchronously via `await createServerClient()`.
  - In Next.js 16, reading cookies at request time outside of Suspense requires either:
    1. `export const instant = false;` on the page/layout segment (incremental adoption), OR
    2. Wrapping user-specific authenticated UI in `<Suspense>`, OR
    3. Marking the function with `'use cache: private'` if caching session-derived data in browser-private cache.
  - They do **not** directly call `Date.now()`, `new Date()`, or `Math.random()`.
  - **Status:** Routes utilizing these helpers are properly guarded when `instant = false` is set on the segment.

### 5.2 `src/lib/clients/queries.ts`
- **Functions:**
  - `getClients()` / `listClients()`: **BLOCKED** by `enrichClientsWithDetails` (`new Date().toISOString()`).
  - `getClientById()`: **BLOCKED** by `enrichClientsWithDetails` (`new Date().toISOString()`).
  - `getClientCounts()`: **CLEAN**. Uses SQL `head: true` count queries only.
  - `getArchivedClients()`: **BLOCKED** if called, because it calls `enrichClientsWithDetails`.
- **Source of Instability:**
  Line 101: `const nowIso = new Date().toISOString();` used on line 117: `.gt('expires_at', nowIso)`.

### 5.3 `src/lib/uploads/queries.ts`
- **Functions:**
  - `listDocuments()`: Queries `documents` table via RLS, orders by `created_at desc`. **CLEAN** of synchronous IO.
  - `getDocument()`: Single row query. **CLEAN**.
  - `createPreviewUrl()`: Calls `supabase.storage.createSignedUrl(storagePath, 300)`. **CLEAN**.
  - `getDocumentStatusCounts()`: Group-by / row-scanning aggregation. **CLEAN**.
- **Status:** All upload queries are clean of synchronous IO calls during render.

### 5.4 `src/lib/period.ts`
- Contains multiple `new Date(dueYear, dueMonth - 1, dueDay)` calls:
  - Line 154: `new Date(dueYear, dueMonth - 1, 11)`
  - Line 159: `new Date(dueYear, dueMonth - 1, 13)`
  - Line 187: `new Date(dueYear, dueMonth - 1, 20)`
  - Line 199: `new Date(dueYear, dueMonth - 1, dueDay)`
  - Line 215: `new Date(dueYear, dueMonth - 1, 14)`
- **Behavior:**
  Because all these invocations pass explicit arguments (`year, month, date`), `arguments.length > 0`. Next.js `date.js` extension specifically checks `if (arguments.length === 0)` before emitting `io('new Date()', 'time')`.
- **Status:** **CLEAN** (Deterministic date arithmetic does not trigger clock interception).

### 5.5 `src/lib/gst/gstin.ts`
- Contains `Math.random()` on lines 151, 154, 161, 162, 170 inside `generateRandomGstin()`.
- **Audit Check:** Neither `generateRandomGstin()` nor any random generator is called by any page, layout, or render function. It is only used by developer test scripts.
- **Status:** **CLEAN**.

### 5.6 `src/lib/uploads/actions.ts` & `src/lib/uploads/cleanup.ts`
- `actions.ts` line 258: `const documentId = crypto.randomUUID();`
  - Runs inside `prepareDocumentUpload` (a Server Action invoked during client mutation). Server Actions execute in POST handlers, not prerender passes.
- `cleanup.ts` line 101: `Date.now()`
  - Runs inside `cleanupStaleUploads` (invoked via `scripts/cleanup-uploads.mjs` CLI / cron).
- **Status:** **CLEAN**.

---

## 6. Comprehensive Inventory of Blocking Route Errors

The following table details every place that would hit a Next.js 16 blocking error, the exact error name, trigger mechanics, and impact:

```
+---------------------------------------------------------------------------------------------------------------------------------------+
| Route / Segment                          | Line / Location                | Error ID                           | Next.js 16 Failure Message                                                  |
+---------------------------------------------------------------------------------------------------------------------------------------+
| src/app/(portal)/portal/bills/page.tsx   | Line 103 (now = new Date())    | blocking-prerender-current-time    | Route "/(portal)/portal/bills": Next.js encountered the unstable value      |
|                                          |                                |                                    | `new Date()` while prerendering.                                            |
|                                          | Line 41, 60 (cookies/session)  | blocking-prerender-runtime         | Next.js encountered runtime data during prerendering: cookies()             |
+---------------------------------------------------------------------------------------------------------------------------------------+
| src/app/(app)/app/clients/page.tsx       | Line 62 -> queries.ts:101      | blocking-prerender-current-time    | Route "/(app)/app/clients": Next.js encountered the unstable value          |
|                                          | (nowIso = new Date()...)       |                                    | `new Date()` while prerendering. (via enrichClientsWithDetails)              |
+---------------------------------------------------------------------------------------------------------------------------------------+
| src/app/(app)/app/clients/[id]/page.tsx  | Line 19 (generateMetadata)     | blocking-prerender-current-time    | Route "/(app)/app/clients/[id]": Next.js encountered the unstable value      |
|                                          | Line 36 (ClientDetailPage)     |                                    | `new Date()` while prerendering. (via enrichClientsWithDetails)              |
|                                          | -> queries.ts:101              |                                    |                                                                              |
+---------------------------------------------------------------------------------------------------------------------------------------+
| src/app/(app)/app/clients/[id]/bills/    | Line 23 (generateMetadata)     | blocking-prerender-current-time    | Route "/(app)/app/clients/[id]/bills": Next.js encountered the unstable      |
| page.tsx                                 | Line 46 (ClientBillsPage)      |                                    | value `new Date()` while prerendering. (via enrichClientsWithDetails)        |
|                                          | -> queries.ts:101              |                                    |                                                                              |
+---------------------------------------------------------------------------------------------------------------------------------------+
| src/app/sitemap.ts                       | Line 10 (lastModified: Date)   | blocking-prerender-current-time    | Route "/sitemap.xml": Next.js encountered the unstable value                 |
|                                          |                                |                                    | `new Date()` while prerendering.                                            |
+---------------------------------------------------------------------------------------------------------------------------------------+
| src/app/(portal)/portal/page.tsx         | Line 30, 52 (cookies/session)  | blocking-prerender-runtime         | Next.js encountered runtime data during prerendering: cookies()             |
|                                          |                                |                                    | (Missing `export const instant = false`)                                     |
+---------------------------------------------------------------------------------------------------------------------------------------+
```

---

## 7. Recommended Action Plan & Remediation Patterns

To unblock the Next.js 16 build cleanly without breaking existing domain invariants or SSR hydration, implement the following fixes:

### 7.1 Remediation Pattern 1: `src/lib/clients/queries.ts` (`enrichClientsWithDetails`)
**Problem:** `enrichClientsWithDetails` calls `new Date().toISOString()` to filter active client invites. Because this helper is invoked by `listClients` and `getClientById`, it crashes every client page during prerender.  
**Recommended Fix:**
Replace JavaScript clock access with PostgreSQL's built-in `now()` timestamp filter, or compare client-side/in-memory without evaluating the system clock during prerender:
```ts
// BEFORE (queries.ts:101, 117):
const nowIso = new Date().toISOString();
...
.gt('expires_at', nowIso)

// AFTER (option A: Database-native filter via ISO string or RPC):
// In Supabase PostgREST, filter using now() or omit client-side date creation:
.filter('expires_at', 'gt', 'now()')
// OR (option B: Evaluate expiration in memory during render without new Date() clock evaluation,
// or pass reference timestamp from request context):
```

### 7.2 Remediation Pattern 2: `src/app/(portal)/portal/bills/page.tsx`
**Problem:** Line 103 directly calls `const now = new Date()` on the server to populate the month dropdown and default month filter. It is also missing `export const instant = false;`.  
**Recommended Fix:**
1. Export `instant = false`:
   ```tsx
   export const instant = false;
   ```
2. Move dynamic month resolution either:
   - Into a Client Component (e.g., inside an interactive `MonthSelector` component), OR
   - Call `await connection()` from `next/server` at the top of the Server Component before accessing the clock (Next.js 16 canonical pattern for request-time clock access):
   ```tsx
   import { connection } from 'next/server';

   export default async function OwnerBillsPage({ searchParams }: BillsPageProps) {
     await connection(); // Informs Next.js this component executes strictly at request time
     const now = new Date(); // Now legal under Cache Components!
     ...
   }
   ```

### 7.3 Remediation Pattern 3: `src/app/sitemap.ts`
**Problem:** `lastModified: new Date()` in root sitemap generator triggers prerender clock abort.  
**Recommended Fix:**
Replace `new Date()` with a static build date string or retrieve last modified date from git/commit metadata:
```ts
// BEFORE:
lastModified: new Date(),

// AFTER:
lastModified: '2026-10-28', // Or a deterministic build timestamp constant
```

### 7.4 Remediation Pattern 4: `src/app/(portal)/portal/page.tsx`
**Problem:** Missing segment opt-out for request-time cookies.  
**Recommended Fix:**
Add `export const instant = false;` to line 8 of `src/app/(portal)/portal/page.tsx` to match `layout.tsx` and the rest of the application.

---

## 8. Verification & Next Steps

1. **Do not modify any code files** during this audit phase (strict Lane B remit).
2. Deliver this audit report (`docs/qa/next16-audit.md`) to the engineering team and Lane A.
3. Once Lane A applies the remediations, verify the build by running:
   ```bash
   npm run build
   ```
   Confirm that all routes compile into static shells and dynamic server streams without any `blocking-prerender-*` errors.
