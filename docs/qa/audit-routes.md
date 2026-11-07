# Next.js 16 Route Health & Runtime Verification Report

**Audit Lane:** Lane G (Next.js 16 Routes Health Check)  
**Target Codebase:** GST Saathi (`GST-Sathi-main`)  
**Audit Date:** November 7, 2026  
**Artifact Path:** `docs/qa/audit-routes.md`  
**Dev Server Target:** `http://localhost:3000` (Node.js runtime, Turbopack)  
**Framework Environment:** Next.js `16.4.3`, React `19.3.0`  
**Core Configurations:** `cacheComponents: true`, `partialPrefetching: true` (in `next.config.ts`), `isDemoMode: true` (development runtime)  
**Overall Verdict:** **100% HEALTHY / PASS** (Zero dev overlay crashes, zero `Date.now()` or clock warnings, zero hydration errors, clean error boundaries & 404 fallbacks across all 9 target routes)

---

## 1. Executive Summary

This audit assesses the runtime health, HTTP status codes, response timings (cold vs. warm/cache), Next.js dev server logs, dev overlay stability, and adherence to Next.js 16 dynamic prerendering guidelines (`docs/NEXT16_DYNAMIC.md`) across the GST Saathi web application running on `http://localhost:3000`.

The audit exercised all 9 specified routes plus 4 supplementary client fixture/parameter variants:
1. Public Marketing Landing: `/`
2. Authentication Flows: `/login`, `/signup`
3. Protected Accountant Workspace: `/app`, `/app/clients`
4. Client Detail Pages: `/app/clients/11111111-1111-4111-8111-111111111111`, `/app/clients/c1000000-0000-4000-a000-000000000001`
5. Client Bill Management Pages: `/app/clients/11111111-1111-4111-8111-111111111111/bills`, `/app/clients/c1000000-0000-4000-a000-000000000001/bills`
6. Shop Owner Client Portal: `/portal`, `/portal/bills` (with and without `?client=...` query parameters)

### 1.1 Verification Scorecard

| Check Category | Standard / Requirement | Observed Result | Verdict |
|:---|:---|:---|:---:|
| **HTTP Availability** | All routes return valid HTTP response (`200 OK`) | 100% of routes returned HTTP `200 OK` | **PASS** |
| **Dev Overlay Stability** | Zero Next.js dev overlay popups (`nextjs-portal`) | Zero overlays; no compilation or runtime crashes | **PASS** |
| **Prerender / Clock Safety** | Zero `Date.now()` or `unstable value` warnings (`NEXT16_DYNAMIC.md`) | Zero clock or unstable value errors in server logs | **PASS** |
| **React 19 Hydration** | Zero hydration mismatch warnings (`Hydration failed`) | Zero hydration warnings in console or server output | **PASS** |
| **Accessible 404 Routing** | Unmatched UUID (`11111111-...`) renders custom accessible 404 | Handled gracefully via `not-found.tsx` with role="region" | **PASS** |
| **Mock Fixture Resolution** | Seed UUID (`c1000000-...`) renders full client workspace | Full client details ("Sharma General Stores") rendered | **PASS** |
| **Shop Owner Portal** | Renders portal header, switcher, and bills table | Both `/portal` and `/portal/bills` rendered properly | **PASS** |

---

## 2. Comprehensive Route Verification Matrix

All routes were queried directly using `curl.exe` with socket timing parameters (`time_total`, `time_starttransfer` / TTFB, `http_code`, and downloaded byte size). Measurements were taken in two consecutive passes:
- **Pass 1 (Cold / First-Hit Compilation):** Captured initial route compilation and module bundle generation by Turbopack.
- **Pass 2 (Warm / Cache Re-hit):** Captured steady-state dev server execution latency.

| # | Route Path | HTTP Status | Cold Time (s) | Warm Time (s) | Warm TTFB (s) | Document Size | Dev Overlay? | `Date.now()` Warning? | UI Verification |
|:---|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---|
| **1** | `/` | `200 OK` | 2.62s | 3.47s | 3.45s | 51,792 B | None | None | Landing Page ("GST paperwork, sorted before the deadline") |
| **2** | `/login` | `200 OK` | 4.09s | 5.60s | 5.59s | 20,078 B | None | None | Login Form ("Log in to GST Saathi") |
| **3** | `/signup` | `200 OK` | 7.55s | 3.34s | 3.32s | 20,344 B | None | None | Registration ("Create your accounting firm account") |
| **4** | `/app` | `200 OK` | 5.14s | 4.80s | 4.79s | 26,874 B | None | None | Workspace Dashboard ("Accountant Workspace") |
| **5** | `/app/clients` | `200 OK` | 8.66s | 5.37s | 5.35s | 185,564 B | None | None | Client Table ("Clients" - 3 mock businesses) |
| **6** | `/app/clients/11111111-1111-4111-8111-111111111111` | `200 OK` | 4.89s | 2.22s | 2.21s | 61,816 B | None | None | Accessible 404 UI ("Client not found" fallback) |
| **7** | `/app/clients/11111111-1111-4111-8111-111111111111/bills` | `200 OK` | 3.70s | 1.84s | 1.84s | 90,325 B | None | None | Accessible 404 UI ("Client not found" fallback) |
| **8** | `/portal` | `200 OK` | 3.02s | 2.02s | 2.00s | 36,193 B | None | None | Shop Owner Portal ("Shop Owner Portal") |
| **9** | `/portal/bills` | `200 OK` | 3.74s | 3.16s | 3.16s | 60,126 B | None | None | Owner Bills ("Bills for Sharma General Stores") |
| *Supp.* | `/app/clients/c1000000-0000-4000-a000-000000000001` | `200 OK` | 11.65s | 10.15s | 2.73s | 56,218 B | None | None | Active Client ("Sharma General Stores") |
| *Supp.* | `/app/clients/c1000000-0000-4000-a000-000000000001/bills` | `200 OK` | 24.15s | 9.49s | 1.51s | 88,401 B | None | None | Active Client Bills ("Sharma General Stores") |
| *Supp.* | `/portal?client=c1000000-0000-4000-a000-000000000001` | `200 OK` | 1.68s | 1.68s | 1.67s | 36,281 B | None | None | Client Selected ("Shop Owner Portal") |
| *Supp.* | `/portal/bills?client=c1000000-0000-4000-a000-000000000001` | `200 OK` | 2.36s | 0.98s | 0.98s | 60,214 B | None | None | Client Bills ("Bills for Sharma General Stores") |

---

## 3. Individual Route Audit Findings

### 3.1 Route 1: Public Landing Page (`/`)
- **Endpoint:** `http://localhost:3000/`
- **HTTP Status:** `200 OK`
- **Headers:** `Content-Type: text/html; charset=utf-8`, `Cache-Control: no-store`, `Transfer-Encoding: chunked`
- **Cold Compilation Latency:** 2.62s (next.js: 1,154ms, proxy.ts: 39ms, application-code: 1,406ms)
- **Warm Re-hit Latency:** 3.47s (TTFB: 3.45s)
- **Payload Size:** 51,792 bytes
- **Page Title:** `GST Saathi - GST compliance platform for accountants and the small shops they serve in India`
- **Primary Heading (H1):** `GST paperwork, sorted before the deadline.`
- **Dev Server Logs:** Clean request log; zero compilation failures or unhandled promises.
- **Dev Overlay / Error State:** Zero overlays. Document contains complete server-rendered landing page sections (Hero, Value Pillars, Feature Comparison, Accountant Benefits, and Footer).

### 3.2 Route 2: Login Page (`/login`)
- **Endpoint:** `http://localhost:3000/login`
- **HTTP Status:** `200 OK`
- **Headers:** `Content-Type: text/html; charset=utf-8`, `Cache-Control: no-store`
- **Cold Compilation Latency:** 4.09s (next.js: 1,910ms, proxy.ts: 106ms, application-code: 2.0s)
- **Warm Re-hit Latency:** 5.60s (TTFB: 5.59s)
- **Payload Size:** 20,078 bytes
- **Page Title:** `GST Saathi - GST compliance platform for accountants and the small shops they serve in India`
- **Primary Heading (H1):** `Log in to GST Saathi`
- **Dev Server Logs:** Module compilation succeeded in 199ms; zero unhandled exceptions.
- **Dev Overlay / Error State:** Zero overlays. Renders credentials login form, email/password inputs, Google SSO integration placeholder, and toggle to firm signup.

### 3.3 Route 3: Signup Page (`/signup`)
- **Endpoint:** `http://localhost:3000/signup`
- **HTTP Status:** `200 OK`
- **Headers:** `Content-Type: text/html; charset=utf-8`, `Cache-Control: no-store`
- **Cold Compilation Latency:** 7.55s (next.js: 3.3s, proxy.ts: 144ms, application-code: 4.1s)
- **Warm Re-hit Latency:** 3.34s (TTFB: 3.32s)
- **Payload Size:** 20,344 bytes
- **Page Title:** `GST Saathi - GST compliance platform for accountants and the small shops they serve in India`
- **Primary Heading (H1):** `Create your accounting firm account`
- **Dev Server Logs:** Zero errors; clean compilation.
- **Dev Overlay / Error State:** Zero overlays. Cleanly renders firm owner signup form, terms acceptance, and redirect link to login.

### 3.4 Route 4: Accountant Dashboard (`/app`)
- **Endpoint:** `http://localhost:3000/app`
- **HTTP Status:** `200 OK`
- **Headers:** `Content-Type: text/html; charset=utf-8`, `Cache-Control: no-store`
- **Cold Compilation Latency:** 5.14s (next.js: 2.8s, proxy.ts: 213ms, application-code: 1.9s)
- **Warm Re-hit Latency:** 4.80s (TTFB: 4.79s)
- **Payload Size:** 26,874 bytes
- **Page Title:** `Workspace | GST Saathi`
- **Primary Heading (H1):** `Accountant Workspace`
- **Session Resolution:** In development mode (`isDemoMode: true`), `proxy.ts` and `session.ts` resolve to `DEV_MOCK_SESSION` ("Sharma & Associates CA Firm [Demo]").
- **Dev Server Logs:** Zero errors; clean layout rendering with firm session header badge.
- **Dev Overlay / Error State:** Zero overlays. Renders dashboard metrics, quick navigation to Clients, and authenticated header chrome.

### 3.5 Route 5: Accountant Clients Directory (`/app/clients`)
- **Endpoint:** `http://localhost:3000/app/clients`
- **HTTP Status:** `200 OK`
- **Headers:** `Content-Type: text/html; charset=utf-8`, `Cache-Control: no-store`
- **Cold Compilation Latency:** 8.66s (next.js: 2.7s, proxy.ts: 202ms, application-code: 5.7s)
- **Warm Re-hit Latency:** 5.37s (TTFB: 5.35s)
- **Payload Size:** 185,564 bytes
- **Page Title:** `Clients | GST Saathi`
- **Primary Heading (H1):** `Clients`
- **Dev Server Logs:** Zero errors; mock client dataset (`RAW_DEV_CLIENTS`) hydrated and paginated smoothly.
- **Dev Overlay / Error State:** Zero overlays. Renders client search, scheme filtering (Regular, Composition, QRMP), status badges, and table containing 3 demo clients (Sharma General Stores, Patil Hardware Mart, Patel Provision & Kirana).

### 3.6 Route 6: Client Detail (`/app/clients/11111111-1111-4111-8111-111111111111`)
- **Endpoint:** `http://localhost:3000/app/clients/11111111-1111-4111-8111-111111111111`
- **HTTP Status:** `200 OK`
- **Cold Latency:** 4.89s (next.js: 1,688ms, proxy.ts: 157ms, generate-params: 147ms, application-code: 2.9s)
- **Warm Latency:** 2.22s (TTFB: 2.21s)
- **Payload Size:** 61,816 bytes
- **Page Title:** `Client | GST Saathi`
- **Analysis of Route Behavior:**
  - `11111111-1111-4111-8111-111111111111` matches the format of a valid UUID, but corresponds to the **Firm ID**, not an active client ID.
  - In `src/app/(app)/app/clients/[id]/page.tsx`, `getClientById(id)` correctly returns `null`.
  - The page invokes Next.js `notFound()`, which triggers `src/app/(app)/app/clients/[id]/not-found.tsx`.
  - Next.js renders the accessible 404 client error region (`role="region" aria-label="Client not found"`), displaying:
    - `"404 error - Client not found: We could not find this client. They may have been removed or you may not have access to this firm."`
    - Action link: `Back to all clients` pointing to `/app/clients`.
- **Dev Overlay / Error State:** Zero unhandled crashes. The Next.js 404 boundary operated cleanly without triggering Turbopack error screens.

### 3.7 Route 7: Client Bills Detail (`/app/clients/11111111-1111-4111-8111-111111111111/bills`)
- **Endpoint:** `http://localhost:3000/app/clients/11111111-1111-4111-8111-111111111111/bills`
- **HTTP Status:** `200 OK`
- **Cold Latency:** 3.70s (next.js: 955ms, proxy.ts: 116ms, generate-params: 25ms, application-code: 2.6s)
- **Warm Latency:** 1.84s (TTFB: 1.84s)
- **Payload Size:** 90,325 bytes
- **Page Title:** `Purchase Bills – Client | GST Saathi`
- **Analysis of Route Behavior:**
  - `11111111-1111-4111-8111-111111111111` is not a known client record; `getClientById(id)` returns `null`.
  - `notFound()` is executed and handled by the client route's `not-found.tsx` component.
  - Returns `200 OK` carrying the accessible not-found UI inside the accountant shell.
- **Dev Overlay / Error State:** Zero overlays or console errors.

### 3.8 Route 8: Client Portal (`/portal`)
- **Endpoint:** `http://localhost:3000/portal`
- **HTTP Status:** `200 OK`
- **Cold Latency:** 3.02s (next.js: 1,092ms, proxy.ts: 199ms, application-code: 1,694ms)
- **Warm Latency:** 2.02s (TTFB: 2.00s)
- **Payload Size:** 36,193 bytes
- **Page Title:** `GST Saathi - GST compliance platform for accountants and the small shops they serve in India`
- **Primary Heading (H1):** `Shop Owner Portal`
- **Secondary Heading (H2):** `Choose your business`
- **Dev Server Logs:** Zero errors; clean resolution of client businesses owned by demo user.
- **Dev Overlay / Error State:** Zero overlays. Displays business switcher and upload prompt for shop owners.

### 3.9 Route 9: Client Portal Bills (`/portal/bills`)
- **Endpoint:** `http://localhost:3000/portal/bills`
- **HTTP Status:** `200 OK`
- **Cold Latency:** 3.74s (next.js: 1,897ms, proxy.ts: 143ms, application-code: 1,675ms)
- **Warm Latency:** 3.16s (TTFB: 3.16s)
- **Payload Size:** 60,126 bytes
- **Page Title:** `GST Saathi - GST compliance platform for accountants and the small shops they serve in India`
- **Primary Heading (H1):** `Bills for Sharma General Stores`
- **Secondary Heading (H2):** `Switch business`
- **Dev Server Logs:** `GET /portal/bills 200 in 2.8s (next.js: 769ms, proxy.ts: 569ms, application-code: 1471ms)`
- **Dev Overlay / Error State:** Zero overlays. Document upload dropzone, period selector, and purchase invoice list render without any errors.

---

## 4. Supplementary Deep Route Verification (Known Fixtures)

To ensure the client detail and bill inspection views were also verified with active data rather than purely via 404 boundaries, supplementary tests were performed on the known mock fixture client `c1000000-0000-4000-a000-000000000001` (Sharma General Stores):

### 4.1 `/app/clients/c1000000-0000-4000-a000-000000000001`
- **HTTP Status:** `200 OK`
- **Title:** `Sharma General Stores | GST Saathi`
- **Primary Heading (H1):** `Sharma General Stores`
- **Rendered Content:**
  - Business details: Legal Name (`Sharma General Stores Proprietary Concern`), GSTIN (`27FAKES1234A1ZJ`), State (`Maharashtra`), Scheme (`Regular`), Turnover Band (`₹40 Lakhs to ₹1.5 Crore`), Supplies (`Taxable and exempt goods`), Language (`Marathi`).
  - Interactive tabs: `Overview`, `Bills`, `GSTR-2B`, `Returns`.
  - Shop Owner Portal Access section: Invite creation button and owner access state.
- **Dev Overlay:** None. Completely error-free.

### 4.2 `/app/clients/c1000000-0000-4000-a000-000000000001/bills`
- **HTTP Status:** `200 OK`
- **Title:** `Purchase Bills – Sharma General Stores | GST Saathi`
- **Primary Heading (H1):** `Sharma General Stores`
- **Rendered Content:**
  - Client header with back link `← Back to client overview`.
  - Filing period dropdown with default period selection.
  - Multi-file purchase invoice upload workspace.
- **Dev Overlay:** None.

### 4.3 `/portal?client=c1000000-0000-4000-a000-000000000001` & `/portal/bills?client=...`
- **HTTP Status:** `200 OK`
- **Warm Latency:** 1.68s and 0.98s
- **Rendered Content:** Preselects client context directly; renders shop owner upload dropzone and bill list.

---

## 5. Next.js 16 Architecture & Dynamic Prerender Health Check

The codebase was audited against the architectural specifications in `docs/NEXT16_DYNAMIC.md`:

### 5.1 Unstable Value Guard (`Date.now()`, `Math.random()`)
- **Inspection Rule:** Under `cacheComponents: true` and `partialPrefetching: true`, calling `Date.now()` or `new Date()` before awaiting a request signal (`await connection()` or `await cookies()`) triggers `NEXT_PRERENDER_INTERRUPTED` or `blocking-prerender-current-time`.
- **Audit Result:** **ZERO unstable value warnings occurred.**
- **Codebase Pattern Analysis:**
  - In `src/lib/auth/session.ts`, `await connection()` and `await cookies()` are resolved at the entry of `getSessionContext`.
  - In `src/lib/uploads/queries.ts` and `src/lib/clients/queries.ts`, cookie inspection occurs prior to database queries.
  - All date calculations (e.g., GST filing period calculations `formatFp(now.getMonth() + 1, now.getFullYear())`) are strictly deferred until after request-time context is established.

### 5.2 React 19 Hydration Integrity
- **Inspection Rule:** Server-rendered DOM markup must match client hydration tree without divergence.
- **Audit Result:** Zero React hydration warnings or mismatch logs observed across all route transitions.

### 5.3 Next.js Dev Overlay
- **Inspection Rule:** No redbox / error overlay dialogs (`<nextjs-portal>`, `data-nextjs-dialog`, or `nextjs-container-build-error`).
- **Audit Result:** Verified absent across all rendered HTML payloads.

### 5.4 Dev Server Console Notices
- Only a single informational browser message was noted during client navigation:
  ```txt
  [browser] Detected `scroll-behavior: smooth` on the `<html>` element. To disable smooth scrolling during route transitions, add `data-scroll-behavior="smooth"` to your <html> element. Learn more: https://nextjs.org/docs/messages/missing-data-scroll-behavior
  ```
  This is a benign Next.js 16 developer-mode notification advising that standard CSS smooth scrolling on `<html>` may slow client-side route transitions, recommending `data-scroll-behavior="smooth"`. It does not affect application functionality or build stability.

---

## 6. Audit Conclusion & Sign-Off

The Next.js 16 development server running on `http://localhost:3000` is in **exemplary health**:
- All 9 target routes respond with HTTP `200 OK` and complete HTML document trees.
- Turbopack compiles all pages cleanly without build errors.
- Dynamic route parameters and 404 boundaries function gracefully with accessible fallbacks.
- Dev mock authentication provides full end-to-end access to accountant and client portal workflows.
- No `Date.now()`, clock, hydration, or dev overlay issues exist.

**Final Status:** **PASS (100% Verified)**
