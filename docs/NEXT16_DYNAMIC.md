# Next.js 16 Dynamic Rendering, Cache Components & Prerendering Architecture

A developer guide and architectural specification for handling dynamic rendering, unstable values (`Date.now()`, `Math.random()`), request-time data access (`cookies()`, `connection()`), and Partial Prerendering (PPR) in **GST Saathi**.

---

## 1. The Core Mechanism: Why Next.js 16 Fails on `Date.now()`

### 1.1 Cache Components & Partial Prerendering (PPR)
In this repository, `next.config.ts` enables both `cacheComponents: true` and `partialPrefetching: true`. Under Next.js 16, this fundamentally transforms how routes are compiled and served:

1. **Static Shell Generation**: During `next build` and when generating instant client navigation prefetches, Next.js executes every App Router route in an isolated **Prerender Tracking Context** (`WorkUnitAsyncStorage`).
2. **Deterministic Prerender Pass**: Next.js attempts to prerender as much of the React Server Component (RSC) tree as possible into static HTML and serialized RSC payload. This static shell is served instantly from edge caches or CDNs without hitting server compute.
3. **Suspended Dynamic Holes**: Portions of the component tree that depend on the incoming HTTP request stream in at request time through React `<Suspense>` boundaries.

### 1.2 The "Unstable Value" Detection Guard
APIs that produce non-deterministic or variable results across invocations are classified by Next.js as **unstable values**:
- `Date.now()`, `new Date()`, `Date()` (system clock)
- `Math.random()`
- `crypto.randomUUID()`, `crypto.getRandomValues()`

When Next.js executes a Server Component during the prerender pass:
- If Next.js encounters an unstable value **before** the component has signaled that it is running at request time, Next.js halts prerendering and fails the build with:
  ```txt
  Route "/...": Next.js encountered the unstable value `Date.now()` while prerendering.

  Learn more: https://nextjs.org/docs/messages/blocking-prerender-current-time
  ```
- **Why?**
  1. **Prevents Stale Freezing**: If Next.js allowed `Date.now()` to execute during static prerendering, the build timestamp would be permanently baked into the static HTML shell. Every user worldwide would see the exact same historical timestamp until the next code deployment.
  2. **Prevents Hydration Mismatches**: In Client Components or during client hydration, a build-time timestamp on the server will never match the browser's execution timestamp, causing catastrophic React hydration errors.
  3. **Guards Developer Intent**: If a feature needs the "current time" (such as determining the default GST return filing month `MMYYYY`, checking token expiry, or computing invoice age), build-time evaluation is a silent semantic defect. Next.js enforces that you handle it explicitly.

### 1.3 Why `export const instant = false;` Does NOT Clear `Date.now()` Errors
A common developer misconception is that adding `export const instant = false;` to a page or layout resolves unstable value errors.
- **It does NOT.**
- `export const instant = false;` only opts a route segment out of *instant navigation validation* for request-time APIs (such as `cookies()`, `headers()`, or uncached `fetch()`), allowing the route to block server execution.
- However, Next.js still executes a static prerender pass to extract any static shell.
- Synchronous non-deterministic calls like `Date.now()`, `new Date()`, or `Math.random()` throw a hard build error that `instant = false` **cannot clear**.
- **The only resolution is to defer execution to request time or cache the value explicitly.**

---

## 2. The Exact Rules for This Repository

| # | Rule | Explanation |
|---|---|---|
| **1** | **No Bare Unstable Calls in Prerender Scope** | Never call `Date.now()`, `new Date()`, `Math.random()`, or `crypto.randomUUID()` at the top level of a Server Component or utility without first establishing request-time context. |
| **2** | **Request Signal Precedence (Order Matters)** | If a Server Component requires current time or random generation, it **MUST await a request-time signal FIRST** (`await connection()` from `next/server` or `await cookies()` / auth helpers) *before* invoking `Date.now()` or `new Date()`. |
| **3** | **Wrap Dynamic Request Components in Suspense** | Components that defer to request time must be wrapped in a `<Suspense fallback={<AccessibleFallback />}>` boundary so the parent layout/shell remains prerenderable. |
| **4** | **Push Dynamic Access Down** | Never invoke request-time blocking calls at the top level of a shared layout (e.g. `(app)/app/layout.tsx` or `(portal)/portal/layout.tsx`) if it blocks `{children}` from prerendering. Keep shared navigation shells static; push user/time access into leaf components. |
| **5** | **Telemetry Exception** | For performance metrics and telemetry logging, use `performance.now()`. Next.js does not guard `performance.now()`, as it measures execution duration rather than wall-clock time. |
| **6** | **Cache Values with `"use cache"` When Deterministic Across Users** | If a random seed or timestamp is meant to be shared across all users until revalidation (e.g. a daily build hash or currency rate), wrap it in an async function with `"use cache"` and `cacheLife()`. |

---

## 3. The Recommended Pattern for Authenticated Layouts & Pages

The canonical architecture for authenticated routes in GST Saathi adheres to:
**"Request Signal First, Inside a Suspense Boundary."**

```
+----------------------------------------------------------------------------------------------------+
|                                    PAGE / LAYOUT (STATIC SHELL)                                    |
|  - Renders instant static header, page title, breadcrumbs, search parameters                       |
|  - Renders <Suspense fallback={<DashboardLoadingSkeleton />}>                                      |
+-------------------------------------------------+--------------------------------------------------+
                                                  |
                                                  v Streams at Request Time
+-------------------------------------------------+--------------------------------------------------+
|                              ASYNC REQUEST COMPONENT (e.g. ClientWorkspace)                        |
|                                                                                                    |
|  1. Await Request Context FIRST:                                                                  |
|     const session = await requireFirmRole('staff');                                                |
|     // (internally resolves await cookies() -> halts static prerender cleanly)                     |
|                                                                                                    |
|  2. Execute Time & Dynamic Operations SECOND:                                                      |
|     const now = new Date();                                                                        |
|     const currentFp = formatFp(now.getMonth() + 1, now.getFullYear());                            |
|                                                                                                    |
|  3. Fetch Authenticated Data & Render UI:                                                          |
|     const bills = await listDocuments(...);                                                        |
+----------------------------------------------------------------------------------------------------+
```

### 3.1 Why Order Matters (The Interruption Principle)
When a Server Component begins rendering:
1. If line 1 is `const now = Date.now();`, Next.js is still in **static prerender mode**. It intercepts the call, flags an unregistered unstable value, and throws `NEXT_PRERENDER_INTERRUPTED` as a fatal build error.
2. If line 1 is `const session = await requireFirmRole('staff');` (or `await connection()`), Next.js catches the request-time API call. It cleanly aborts the prerender pass for that subtree and defers execution until an incoming HTTP request arrives.
3. At request time, Next.js resumes rendering the component. When line 2 (`new Date()`) runs, the runtime is already in **request mode**. `new Date()` executes safely without any error.

### 3.2 Canonical Implementation: Authenticated Page

```tsx
// src/app/(app)/app/clients/[id]/bills/page.tsx
import { Suspense } from 'react';
import { requireFirmRole } from '@/lib/auth/roles';
import { listDocuments } from '@/lib/uploads/queries';
import { formatFp } from '@/lib/period';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ month?: string }>;
}

export default async function ClientBillsPage({ params, searchParams }: PageProps) {
  // 1. Next.js 16 params and searchParams are Promises: unwrap them first
  const { id: clientId } = await params;
  const search = searchParams ? await searchParams : {};

  return (
    <div className="space-y-6">
      {/* Static header - prerenders into the instant static shell */}
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Client Purchase Bills</h1>
        <p className="text-sm text-muted">Upload and manage purchase invoices for GST reconciliation.</p>
      </header>

      {/* Dynamic content deferred to request time behind a Suspense boundary */}
      <Suspense fallback={<BillsSectionSkeleton />}>
        <BillsContent clientId={clientId} requestedMonth={search.month} />
      </Suspense>
    </div>
  );
}

/**
 * Async Server Component: executes at request time.
 */
async function BillsContent({
  clientId,
  requestedMonth,
}: {
  clientId: string;
  requestedMonth?: string;
}) {
  // STEP 1: Establish request context FIRST via cookies/session
  // (Alternatively: `await connection()` from 'next/server' if no session is needed)
  const session = await requireFirmRole('staff');

  // STEP 2: Time operations are now 100% safe because prerendering was deferred
  const now = new Date();
  const defaultMonth = formatFp(now.getMonth() + 1, now.getFullYear());
  const selectedMonth = requestedMonth || defaultMonth;

  // STEP 3: Fetch data scoped to the verified session
  const documents = await listDocuments(clientId, {
    firmId: session.firm.id,
    filingPeriod: selectedMonth,
  });

  return (
    <div>
      <p className="text-sm text-muted">Current filing period: {selectedMonth}</p>
      {/* Render Document Table / Uploads */}
    </div>
  );
}

function BillsSectionSkeleton() {
  return (
    <div className="animate-pulse space-y-4" role="status" aria-label="Loading bills workspace">
      <div className="h-10 bg-surface rounded-lg w-1/4" />
      <div className="h-64 bg-surface rounded-lg w-full" />
      <span className="sr-only">Loading client bills and filing periods...</span>
    </div>
  );
}
```

### 3.3 What to Do When Route Does Not Read Cookies: `connection()`
If a Server Component needs `Date.now()` or `Math.random()` but does **not** read cookies, headers, or Supabase session auth, use `connection()` from `'next/server'`:

```tsx
import { connection } from 'next/server';
import { Suspense } from 'react';

async function CurrentServerTime() {
  // Prerendering cleanly stops here:
  await connection();

  // Runs only at request time:
  const now = new Date();
  return <time dateTime={now.toISOString()}>{now.toLocaleTimeString('en-IN')}</time>;
}

export default function TimeWidget() {
  return (
    <Suspense fallback={<span>Loading current time...</span>}>
      <CurrentServerTime />
    </Suspense>
  );
}
```

---

## 4. DO and DON'T List for Developers

### DO:
1. **DO access request data first**: Call `await connection()`, `await cookies()`, or session helpers (`requireFirmRole`, `requireClientAccess`) before calling `new Date()` or `Date.now()`.
2. **DO wrap dynamic request components in `<Suspense>`**: Provide accessible, plain-language loading skeletons (`fallback={<Skeleton />}`) with screen-reader text (`<span className="sr-only">Loading...</span>`).
3. **DO await `params` and `searchParams`**: In Next.js 16, `params` and `searchParams` are Promises (`const { id } = await params;`).
4. **DO use `performance.now()` for telemetry**: For execution profiling and latency logging, `performance.now()` is permitted during prerender.
5. **DO use `"use cache"` for static shared data**: For data that should be computed once and shared across all users (with `cacheTag` and `cacheLife`), use the `"use cache"` directive.
6. **DO push dynamic access down**: Keep layout shells and navigation chrome static; put user session badges and dynamic streams into isolated child components.

### DON'T:
1. **DON'T call `Date.now()`, `new Date()`, or `Math.random()` before awaiting request data**: Calling them before `await cookies()` or `await connection()` breaks static prerendering and fails the build.
2. **DON'T rely on `export const instant = false;` to fix `Date.now()`**: `instant = false` does not clear synchronous IO errors; it only relaxes instant prefetch validation for request-time APIs.
3. **DON'T use deprecated Next.js 14/15 segment configs**: Never export `export const dynamic = 'force-dynamic'`, `export const revalidate = 0`, or call `unstable_noStore()`. These are deprecated in Next.js 16 with Cache Components.
4. **DON'T combine `connection()` with `"use cache"`**: `"use cache"` marks a function to be cached across users; `connection()` forces per-request execution. Combining them causes a compile error.
5. **DON'T use empty `<Suspense fallback={null}>`**: Always provide a meaningful loading indicator matching the size and layout of the streaming component to prevent cumulative layout shift (CLS).
6. **DON'T set cookies during Server Component rendering**: Reading cookies works via `cookies()`, but setting cookies must occur inside Server Actions (`'use server'`), Route Handlers (`src/app/api/...`), or `src/proxy.ts`.

---

## 5. Quick Diagnostic & Troubleshooting Reference

### Error: `Next.js encountered the unstable value 'Date.now()' while prerendering`
- **Root Cause**: `Date.now()` or `new Date()` was invoked before the prerender engine encountered a request boundary.
- **Fix**: Move `await connection()` or the session auth check (`await requireFirmRole()`) to the top of the function, before calculating dates.

### Error: `Next.js encountered uncached data during prerendering`
- **Root Cause**: An uncached `fetch()` or `connection()` call was made directly inside a page/layout without a `<Suspense>` boundary.
- **Fix**: Either wrap the calling component in `<Suspense fallback={...}>` (recommended for streaming) or cache the data with `"use cache"`.

### Build Verification Command
Run the build with debug flags to verify zero prerender violations across all routes:
```bash
npm run typecheck
npm run build
```
For deep source-mapped diagnostics on any prerender bailout:
```bash
npx next build --debug-prerender
```
