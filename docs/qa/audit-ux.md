# UX, Copy & State Completeness Audit Report (Lane H)

**Project:** GST Saathi ?" Complete Application UX, Copy, Token & Next.js App Router State Audit  
**Audit Date:** November 7, 2026  
**Auditor:** Lane H Reviewer (UX, Copy, Design System & Application Architecture Reviewer)  
**Scope Surfaces:** Entire `src/` directory (154 source files, 17 App Router routes, 36 shared UI/feature components, configuration, and libraries)  
**Conformance Standards:**
- WCAG 2.2 Level AA (Visual contrast, touch targets $\ge 48\text{px}$, ARIA live regions, skip links)
- GST Saathi Design Token Contract (Strict light theme, CSS variable design tokens only, zero arbitrary hex leaks)
- Next.js 15/16 App Router Error & Loading Boundary Specifications (Nested route error isolation, streaming Suspense)
- Indian SME & Kirana Usability Standards (Zero-jargon, mobile-first stability at 375px, trustworthy plain English)

**Overall Audit Status:** **ACTION REQUIRED (PASS WITH REMEDIATIONS)**  
*Core visual tokens, accessibility sizing, and plain-English tone meet exemplary standards. However, several critical UX gaps require remediation prior to production rollout: an unauthenticated "Dev Preview" bypass card is exposed on `/login`, placeholder "Coming next" panels remain mounted in client tabs, broken anchor links leak on legal sub-pages, legal links are absent from the global footer, metadata titles are missing on 8 routes, and high-traffic Server Components lack `loading.tsx` and `error.tsx` boundaries.*

---

## Executive Summary & Scorecard

This audit conducted an exhaustive, code-level analysis of all user experience surfaces across `src/` to identify placeholder text, brand naming inconsistencies, color token violations, dead links, placeholder UI panels, and missing React/Next.js loading and error boundaries.

### Audit Vector Scorecard

| Audit Vector | Scope & Rule | Status | Summary of Findings |
|---|---|:---:|---|
| **1. Placeholder & Mock Copy** | Detect "Lorem ipsum", TODOs, mock strings, sample emails/GSTINs, and unfinished copy | **WARN** | Zero "Lorem ipsum" and zero TODO comments found in source code. However, 12 mock business profiles with "FAKE" GSTINs exist in `dev-mock.ts`, 4 input forms display `example.com` placeholders, and landing CTA copy still advertises "Early Access" via email rather than live self-serve signup. |
| **2. Product Name Normalization** | Single source of truth in `src/config/site.ts`; no hardcoded brand strings outside config | **FAIL** | Exactly 21 instances of hardcoded "GST Saathi" discovered across 17 files outside `src/config/site.ts` (including 7 page metadata titles, 5 layout/auth headers, 2 WhatsApp share messages, and legal terms). Root layout lacks a `title.template`. |
| **3. Design Token Compliance** | Zero hardcoded `#[0-9a-fA-F]{3,8}` hex values in components/styles; strict token usage | **PASS (EXEMPLARY)** | Zero component hex leaks. Zero standard Tailwind palette leaks (`gray-*`, `blue-*`). Exactly 18 hex definitions: 16 in `app/globals.css` defining the CSS variable design tokens, and 2 in `app/icon.tsx` (Satori favicon generator where CSS variables cannot be evaluated). |
| **4. Placeholder & Preview Panels** | "Coming next" panels, dev preview cards, or work-in-progress UI mounted in view | **FAIL (CRITICAL)** | Critical leak: Public `/login` unconditionally mounts an unauthenticated **"Dev UI/UX Preview"** quick-bypass card. Additionally, two "Coming next" placeholder panels remain mounted under the GSTR-2B and Returns tabs on `/app/clients/[id]`. |
| **5. Dead Links & Navigation Routing** | Check `href="#"`, broken anchors, missing pages, and protocol validity | **WARN** | Zero literal `href="#"` links. However, `<Header />` and `<Footer />` render relative `#how-it-works` and `#for-accountants` anchors that break when clicked from `/privacy` or `/terms`. Global `<Footer />` completely omits links to `/terms` and `/privacy`. Native `<a>` reloads found in `invite` and `login`. Placeholder email `hello@example.com` used across all contact points. |
| **6. Loading & Error Boundaries** | Check Next.js `loading.tsx`, `error.tsx`, `not-found.tsx`, and `<Suspense>` boundaries | **WARN** | 8 out of 17 routes completely lack metadata titles. Root lacks `loading.tsx` and `global-error.tsx`. Both `(app)/app` and `(portal)/portal` lack layout-level error boundaries, meaning errors on `/portal` or `/app` bubble to root and destroy the workspace layout shell. `/app`, `/portal`, `/app/clients/new`, and `/invite/[token]` lack loading skeletons. |

---

## 1. Placeholder Text, Mock Strings & Unfinished Copy

### 1.1 Complete Placeholder Inventory

| File Path | Line | Element / Context | Current Text / Value | Classification | Remediation Required |
|---|---|---|---|---|---|
| `src/app/(auth)/login/page.tsx` | 64?"89 | Dev Preview Card | `"Dev UI/UX Preview"`, `"Direct access to test inside UI/UX without credentials:"` | **Mock / Dev Bypass** | Remove dev card from production view; gate strictly behind `process.env.NODE_ENV === 'development'`. |
| `src/config/site.ts` | 29 | Site Contact Email | `contactEmail: "hello@example.com"` | **Placeholder Domain** | Replace with registered business support address (e.g. `support@gstsaathi.in`). |
| `src/config/site.ts` | 30 | Site Base URL | `url: process.env.NEXT_PUBLIC_SITE_URL \|\| "https://example.com"` | **Placeholder Domain** | Ensure production canonical URL defaults to `https://gstsaathi.in` or similar official domain. |
| `src/app/(auth)/forgot-password/page.tsx` | 112 | Email input placeholder | `placeholder="ca@example.com"` | **Mock Domain** | Replace with realistic Indian CA example (e.g. `ca.sharma@gmail.com` or `name@firmname.in`). |
| `src/app/(auth)/login/page.tsx` | 148 | Password tab email placeholder | `placeholder="ca@example.com"` | **Mock Domain** | Replace with realistic Indian practitioner example (`ca.sharma@gmail.com`). |
| `src/app/(auth)/login/page.tsx` | 248 | OTP tab email placeholder | `placeholder="ca@example.com"` | **Mock Domain** | Replace with realistic Indian practitioner example (`ca.sharma@gmail.com`). |
| `src/app/(auth)/signup/page.tsx` | 108 | Firm owner email placeholder | `placeholder="ramesh@example.com"` | **Mock Domain** | Replace with realistic Indian name (`ramesh.patel@gmail.com`). |
| `src/app/(auth)/invite/[token]/page.tsx` | 114 | Client email placeholder | `placeholder="name@company.com"` | **Generic Placeholder** | Replace with realistic Kirana/SME example (`storeowner@gmail.com`). |
| `src/app/(auth)/invite/[token]/page.tsx` | 148 | OTP code placeholder | `placeholder="123456"` | **Mock Digits** | Acceptable as format hint, but `placeholder="••••••"` or blank is cleaner. |
| `src/app/(auth)/login/page.tsx` | 318 | Login OTP placeholder | `placeholder="123456"` | **Mock Digits** | Acceptable as format hint, or replace with `••••••`. |
| `src/components/clients/ComingNext.tsx` | 12 | Default scope notice prop | `"This milestone focuses on client onboarding and owner access. Upload and tax processing features will connect here next."` | **Roadmap / Milestone Text** | Internal sprint milestone wording exposed in UI component. |
| `src/components/clients/ComingNext.tsx` | 17 | Badge text | `"Coming next"` | **Placeholder Badge** | Placeholder feature panel. |
| `src/components/clients/DetailTabs.tsx` | 208 | Source code comment | `{/* Bills Tab Panel: Renders live bills content (Coming next is removed) */}` | **Code Hygiene** | Outdated comment indicating partial removal of Coming Next. |
| `src/lib/clients/messages.ts` | 253?"256 | Detail page comingNext messages | `billsDescription`, `gstr2bDescription`, `returnsDescription` | **Placeholder Copy Repository** | Outdated dictionary keys for unlaunched feature tabs. |
| `src/components/sections/Hero.tsx` | 17?"18, 25 | Hero CTA & Subtitle | `"Get early access"`, `"Early access. Built for small shops and their accountants."` | **Pre-Launch Copy** | Outdated pre-launch copy; conflicts with live self-serve registration on `/signup`. |
| `src/components/sections/FinalCta.tsx` | 19?"31 | Final section heading & button | `"Want early access?"`, `"Write to us to get early access..."`, `mailto:...` | **Pre-Launch Copy** | Replaces signup flow with email request to `hello@example.com`. |
| `src/components/sections/Problem.tsx` | 5 | Source code comment | `// Figures to be re-verified (see docs/RULES_TO_VERIFY.md)` | **Copy Verification Advisory** | Tax penalties (`₹50 a day`, `18% a year`, `14th`) require statutory confirmation before live marketing. |
| `src/lib/auth/dev-mock.ts` | 10?"45 | Demo Session Context | `ca.demo@gstsaathi.in`, `Sharma & Associates CA Firm [Demo]` | **Mock Session Data** | Loaded when `isDemoMode` is enabled or in development. |
| `src/lib/auth/dev-mock.ts` | 66?"259 | 12 Raw Demo Clients | `27FAKES1234A1ZJ`, `27FAKEP5678B1ZW`, `24FAKET9012C1ZC`, etc. | **Mock Fixtures** | 12 mock clients with `"FAKE"` embedded in GSTINs used during demo mode. |

### 1.2 "Lorem Ipsum" and TODO Scan Findings
- **"Lorem Ipsum" Occurrences:** Exactly **0** in `src/`. No dummy Latin text exists in any component or page.
- **"TODO" / "FIXME" / "TBD" Occurrences:** Exactly **0** code comments or UI strings found across all text files in `src/`.
- **Verdict:** High engineering discipline regarding development scratch comments; all unfinished states have been converted into explicit UX copy or milestone cards.

---

## 2. Hardcoded Product Name Audit

### 2.1 Single Source of Truth Contract
The product name is canonically declared in `src/config/site.ts`:
```ts
// src/config/site.ts
export const siteConfig: SiteConfig = {
  name: "GST Saathi",
  tagline: "GST compliance platform for accountants and the small shops they serve in India",
  ...
};
```
Best practice requires importing `siteConfig.name` or using Next.js App Router metadata templates rather than hardcoding string literals.

### 2.2 Complete List of Hardcoded Occurrences (21 Matches)

Outside of `src/config/site.ts`, exactly **21 occurrences across 17 files** hardcode the product name:

```
src/
├── app/
│   ├── (app)/app/
│   │   ├── clients/
│   │   │   ├── new/page.tsx:10            --> title: 'Add Client | GST Saathi'
│   │   │   ├── page.tsx:16                --> title: 'Clients | GST Saathi'
│   │   │   ├── [id]/bills/page.tsx:27     --> title: `Purchase Bills – ${name} | GST Saathi`
│   │   │   ├── [id]/edit/page.tsx:16      --> title: 'Edit Client | GST Saathi'
│   │   │   └── [id]/page.tsx:23           --> title: `${name} | GST Saathi`
│   │   ├── layout.tsx:11                  --> title: 'Accountant Workspace | GST Saathi'
│   │   ├── layout.tsx:45                  --> <Link href="/app">GST Saathi</Link>
│   │   └── page.tsx:9                     --> title: 'Workspace | GST Saathi'
│   ├── (auth)/
│   │   ├── forgot-password/page.tsx:27    --> <Link href="/">GST Saathi</Link>
│   │   ├── login/page.tsx:52              --> <Link href="/">GST Saathi</Link>
│   │   ├── login/page.tsx:55              --> <h1 ...>Log in to GST Saathi</h1>
│   │   └── reset-password/page.tsx:33     --> <Link href="/">GST Saathi</Link>
│   ├── (portal)/portal/
│   │   ├── layout.tsx:41                  --> {/* Left: GST Saathi + Business Name */}
│   │   └── layout.tsx:47                  --> <Link href="/portal">GST Saathi</Link>
│   └── terms/page.tsx:56                  --> "GST Saathi helps accountants organize bills..."
├── components/
│   └── clients/OwnerAccess.tsx:183        --> '...with our accounting firm on GST Saathi: '
└── lib/
    ├── auth/dev-mock.ts:17                --> email: 'ca.demo@gstsaathi.in'
    ├── auth/messages.ts:127               --> welcome: 'You have been invited to collaborate on GST Saathi.'
    ├── clients/messages.ts:3              --> * for client business management in GST Saathi.
    ├── clients/messages.ts:194            --> whatsAppText: 'Namaste! Here is your secure GST Saathi link...'
    └── domain/index.ts:2                  --> * GST Saathi Domain Models
```

### 2.3 Key Inconsistencies & Recommendations

1. **Missing Root Title Template:**  
   In `src/app/layout.tsx`, metadata is defined as:
   ```ts
   export const metadata: Metadata = {
     title: `${siteConfig.name} - ${siteConfig.tagline}`,
     description: siteConfig.tagline,
   };
   ```
   **Fix:** Upgrade to Next.js title template syntax:
   ```ts
   export const metadata: Metadata = {
     title: {
       default: `${siteConfig.name} – ${siteConfig.tagline}`,
       template: `%s | ${siteConfig.name}`,
     },
     description: siteConfig.tagline,
   };
   ```
   This eliminates hardcoding `\| GST Saathi` in child page titles (e.g. `title: 'Clients'` instead of `title: 'Clients \| GST Saathi'`).

2. **Inconsistent Brand Header Links:**  
   - `src/app/(auth)/signup/page.tsx:32` correctly references `{siteConfig.name}`.
   - `src/app/(auth)/login/page.tsx:52`, `forgot-password/page.tsx:27`, and `reset-password/page.tsx:33` hardcode `"GST Saathi"`.
   - `(app)/app/layout.tsx:45` and `(portal)/portal/layout.tsx:47` hardcode `"GST Saathi"` instead of `{siteConfig.name}`.

3. **WhatsApp Share Message Divergence:**  
   `src/lib/clients/messages.ts:194` provides a localized greeting:
   `whatsAppText: 'Namaste! Here is your secure GST Saathi link to share bills with your CA:'`  
   However, `src/components/clients/OwnerAccess.tsx:183` ignores this dictionary entry and hardcodes an alternate string:
   `'Hello! Here is your private link to share your GST bills with our accounting firm on GST Saathi: ' + resolvedInviteUrl`  
   **Fix:** Point `OwnerAccess.tsx` to `CLIENT_MESSAGES.ownerAccess.whatsAppText`.

---

## 3. Hardcoded Hex Colours & Design Token Rule

### 3.1 Design Token Architecture
GST Saathi enforces a **strict Light Theme Only** token contract declared via CSS custom properties in `src/app/globals.css`. Components must only consume semantic utility classes (`bg-background`, `bg-surface`, `text-ink`, `text-muted`, `border-line`, `bg-accent`, `hover:bg-accent-hover`, `text-on-accent`).

### 3.2 Hex Code Scan Results (`#[0-9a-fA-F]{3,8}`)

A regex scan of all files in `src/` yielded **18 total hex matches**, isolated to exactly **2 files**:

```
src/app/globals.css:
  Line 4:   --color-background: #FFFFFF;
  Line 5:   --color-surface: #F6F6F4;
  Line 6:   --color-ink: #0B0B0C;
  Line 7:   --color-muted: #55555C;
  Line 8:   --color-line: #E3E3E0;
  Line 9:   --color-accent: #1D4ED8;
  Line 10:  --color-accent-hover: #1E40AF;
  Line 11:  --color-on-accent: #FFFFFF;
  Line 16:  --background: #FFFFFF;
  Line 17:  --surface: #F6F6F4;
  Line 18:  --ink: #0B0B0C;
  Line 19:  --muted: #55555C;
  Line 20:  --line: #E3E3E0;
  Line 21:  --accent: #1D4ED8;
  Line 22:  --accent-hover: #1E40AF;
  Line 23:  --on-accent: #FFFFFF;

src/app/icon.tsx:
  Line 20:  backgroundColor: "#0B0B0C",
  Line 21:  color: "#FFFFFF",
```

### 3.3 Token Compliance Assessment
- **`src/app/globals.css` (16 matches):** **VALID.** This is the foundational source of truth where CSS variables are declared.
- **`src/app/icon.tsx` (2 matches):** **PERMISSIBLE ADVISORY.** Next.js dynamic `ImageResponse` executes via `@vercel/og` / Satori in an isolated node context that cannot evaluate runtime CSS stylesheet custom properties. Satori requires explicit color values. The values `#0B0B0C` (matching `--color-ink`) and `#FFFFFF` (matching `--color-background`) maintain exact fidelity with the token palette.
- **Components & Layouts (`src/components/*`, `src/app/*`):** **100% COMPLIANT.** Exactly **zero** arbitrary color classes (e.g. `bg-[#...]`), zero inline `style={{ color: '#...' }}` overrides, and zero standard Tailwind palette colors (`text-gray-*`, `bg-blue-*`, etc.) were detected in any component.

---

## 4. "Coming Next" & Placeholder Panels in UI

### 4.1 "Dev UI/UX Preview" Quick Bypass on `/login` (CRITICAL)

In `src/app/(auth)/login/page.tsx` (lines 64?"89), the following card is rendered unconditionally above the sign-in form:

```tsx
{/* Dev Preview Quick Bypass */}
<div className="mb-6 p-4 rounded-[10px] bg-accent/10 border border-accent/20">
  <div className="flex items-center gap-2 mb-1.5">
    <span className="inline-block w-2 h-2 rounded-full bg-accent" />
    <span className="text-xs font-bold uppercase tracking-wider text-accent">
      Dev UI/UX Preview
    </span>
  </div>
  <p className="text-xs text-muted mb-3">
    Direct access to test inside UI/UX without credentials:
  </p>
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
    <a
      href="/app"
      className="inline-flex items-center justify-center py-2.5 px-3 rounded-lg bg-accent text-on-accent text-xs font-semibold hover:bg-accent-hover transition-colors min-h-[44px] shadow-sm text-center"
    >
      Accountant Workspace →
    </a>
    <a
      href="/portal"
      className="inline-flex items-center justify-center py-2.5 px-3 rounded-lg border border-line bg-surface text-ink text-xs font-semibold hover:bg-surface/80 transition-colors min-h-[44px] shadow-sm text-center"
    >
      Client Portal →
    </a>
  </div>
</div>
```

**UX & Security Impact:**
1. Any visitor or client navigating to `/login` sees an obvious development banner that degrades commercial credibility.
2. The buttons use native `<a>` tags with `min-h-[44px]` (violating the $\ge 48\text{px}$ touch target standard).
3. If clicked in production without an active session, it redirects to `/login` anyway (or to mock session if `DEMO_MODE=true`), creating confusing circular navigation.
4. **Remediation:** Remove completely or wrap with `if (process.env.NODE_ENV === 'development')`.

---

### 4.2 Placeholder Tabs in Client Detail (`src/components/clients/DetailTabs.tsx`)

In `DetailTabs.tsx` (lines 229?"245), the tab panel retains two active placeholder panels powered by `ComingNext.tsx`:

```tsx
{activeTab === 'gstr2b' && (
  <div role="tabpanel" id="tabpanel-gstr2b" aria-labelledby="tab-gstr2b">
    <ComingNext
      title="Government GSTR-2B reconciliation"
      description="Import monthly GSTR-2B JSON and Excel data from the GST portal and automatically match against purchase bills."
    />
  </div>
)}

{activeTab === 'returns' && (
  <div role="tabpanel" id="tabpanel-returns" aria-labelledby="tab-returns">
    <ComingNext
      title="Draft GSTR-1 and GSTR-3B returns"
      description="Review auto-drafted returns, preview tax liabilities and input tax credit, and export JSON for human portal filing."
    />
  </div>
)}
```

Inside `src/components/clients/ComingNext.tsx`:
```tsx
export function ComingNext({
  title,
  description,
  scopeNotice = 'This milestone focuses on client onboarding and owner access. Upload and tax processing features will connect here next.',
}: ComingNextProps) { ... }
```

**UX Impact:**
- Accountants navigating the client workspace encounter tabs that display a placeholder card stating: *"This milestone focuses on client onboarding and owner access..."*
- **Remediation Options:**
  - *Option A (Recommended for Production):* Hide or disable the `GSTR-2B` and `Returns` tabs in the tab header until those features are actively backed by data processing.
  - *Option B (Preview Advisory):* If tabs must remain visible to communicate product roadmap, update the `scopeNotice` prop to remove internal sprint language (*"This milestone focuses on..."*) in favor of client-facing copy: *"GSTR-2B auto-import and return generation are scheduled for the next release."*

---

## 5. Dead Links, Navigation Anchors & Routing Integrity

### 5.1 Link Inventory Breakdown
Total links analyzed across `src/`: **73 links**
- **Static Internal Routes:** 45 links (`/app`, `/app/clients`, `/app/clients/new`, `/login`, `/signup`, `/portal`, `/portal/bills`, `/terms`, `/privacy`, `/no-access`)
- **Dynamic Internal Routes:** 19 links (`/app/clients/${client.id}`, `/portal/bills?client=...&month=...`, etc.)
- **Fragment Links:** 5 links (`#main-content`, `#portal-main`, `#contact`, `#how-it-works`)
- **External / Protocol Links:** 4 links (`mailto:${siteConfig.contactEmail}`)
- **Literal Dead Links (`href="#"`):** **0 occurrences**

---

### 5.2 Critical Navigation Bugs & Discrepancies

#### Bug 1: Broken Fragment Links on Sub-Pages (`/privacy` and `/terms`)
- In `src/config/site.ts`:
  ```ts
  navLinks: [
    { label: "How it works", href: "#how-it-works" },
    { label: "For accountants", href: "#for-accountants" },
  ]
  ```
- `<Header />` and `<Footer />` iterate over `siteConfig.navLinks`.
- Both `src/app/privacy/page.tsx` and `src/app/terms/page.tsx` render `<Header />` and `<Footer />`.
- When a user on `https://gstsaathi.in/privacy` or `/terms` clicks *"How it works"* in the navigation bar, the browser resolves the anchor relative to the current path: `/privacy#how-it-works`.
- Neither `/privacy` nor `/terms` has an element with `id="how-it-works"`. The link fails silently, failing to navigate back to the landing page.
- **Fix:** Update `siteConfig.navLinks` to use absolute anchor paths:
  ```ts
  navLinks: [
    { label: "How it works", href: "/#how-it-works" },
    { label: "For accountants", href: "/#for-accountants" },
  ]
  ```

#### Bug 2: Global Footer Omits Legal Links (`/terms` and `/privacy`)
- `src/components/layout/Footer.tsx` renders:
  - Brand summary
  - `siteConfig.navLinks`
  - `Log in` (`/login`)
  - `Create account` (`/signup`)
  - `mailto:${siteConfig.contactEmail}`
- **Omission:** The footer contains **no links** to `/terms` or `/privacy`.
- A user visiting the landing page has no footer navigation to read the Privacy Policy or Terms of Service. Currently, `/terms` and `/privacy` can only be reached via tiny checkboxes on `/signup` or by manually entering the URL.
- **Fix:** Add standard legal navigation links to `<Footer />`:
  ```tsx
  <Link href="/terms" className="...">Terms of Service</Link>
  <Link href="/privacy" className="...">Privacy Policy</Link>
  ```

#### Bug 3: Full Page Reload on Client Invite Page
- In `src/app/(auth)/invite/[token]/page.tsx` (lines 156?"162):
  ```tsx
  <a
    href={`/invite/${token}`}
    className="inline-flex items-center justify-center min-h-[48px] text-sm font-medium text-muted hover:text-ink transition-colors"
  >
    Use a different email
  </a>
  ```
- Uses a standard HTML `<a>` tag instead of Next.js `<Link>`. This triggers a full browser reload, discarding in-memory client state.
- **Fix:** Replace with `<Link href={`/invite/${token}`} className="...">`.

#### Bug 4: Landing Page CTA Email Trap vs Live Self-Serve Signup
- `src/components/sections/Hero.tsx:17` has a primary CTA: `<Button href="#contact" variant="primary">Get early access</Button>`.
- Clicking this scrolls to `#contact` (`src/components/sections/FinalCta.tsx`), which renders:
  `<Button href={`mailto:${siteConfig.contactEmail}?subject=Early%20Access%20Request`}>Get early access</Button>`.
- This opens the user's desktop email client addressed to `hello@example.com`.
- Meanwhile, the Header top-right button offers a direct self-serve `Create account` link pointing to `/signup`.
- **UX Incoherence:** The primary hero button routes users into an email inquiry to a placeholder address, hiding the fact that the application already possesses a fully functioning self-serve firm registration at `/signup`.
- **Fix:** Change the Hero primary CTA to point directly to `/signup` (`Create account`).

---

## 6. Loading States, Error Boundaries & Suspense Architecture

### 6.1 Route-by-Route State Matrix

The Next.js App Router relies on nested `loading.tsx` (React Suspense streaming) and `error.tsx` (React Error Boundary) to prevent unhandled exceptions in child components from unmounting root shells and navigation.

| Route | File Path | Component Type | Local `loading.tsx` | Local `error.tsx` | Inherited Loading | Inherited Error | Missing State Risk |
|---|---|---|:---:|:---:|:---:|:---:|---|
| `/` | `src/app/page.tsx` | Server (Sync) | ❌ | ❌ | None | `app/error.tsx` | Low (Static render) |
| `/privacy` | `src/app/privacy/page.tsx` | Server (Sync) | ❌ | ❌ | None | `app/error.tsx` | Low (Static render) |
| `/terms` | `src/app/terms/page.tsx` | Server (Sync) | ❌ | ❌ | None | `app/error.tsx` | Low (Static render) |
| `/no-access` | `src/app/no-access/page.tsx` | Server (Sync) | ❌ | ❌ | None | `app/error.tsx` | Low (Static render) |
| `/login` | `src/app/(auth)/login/page.tsx` | Client (`'use client'`) | ❌ | ❌ | None | `app/error.tsx` | Has local `<Suspense>` for searchParams |
| `/signup` | `src/app/(auth)/signup/page.tsx` | Client (`'use client'`) | ❌ | ❌ | None | `app/error.tsx` | Has form error alert state |
| `/forgot-password` | `src/app/(auth)/forgot-password/page.tsx` | Client (`'use client'`) | ❌ | ❌ | None | `app/error.tsx` | Has inline error & success banner |
| `/reset-password` | `src/app/(auth)/reset-password/page.tsx` | Client (`'use client'`) | ❌ | ❌ | None | `app/error.tsx` | Has local `<Suspense>` for searchParams |
| `/invite/[token]` | `src/app/(auth)/invite/[token]/page.tsx` | Server (Async DB) | ❌ | ❌ | None | `app/error.tsx` | **HIGH:** DB RPC call on render with no skeleton |
| `/app` | `src/app/(app)/app/page.tsx` | Server (Async DB) | ❌ | ❌ | None | `app/error.tsx` | **HIGH:** Summary query runs with no loading skeleton |
| `/app/clients` | `src/app/(app)/app/clients/page.tsx` | Server (Async DB) | ✅ | ✅ | Local | Local | **EXEMPLARY:** Full mobile/desktop skeleton & retry UI |
| `/app/clients/new` | `src/app/(app)/app/clients/new/page.tsx` | Server (Async DB) | ❌ | ❌ | None | `app/error.tsx` | Moderate (Form page) |
| `/app/clients/[id]` | `src/app/(app)/app/clients/[id]/page.tsx` | Server (Async DB) | ✅ | ❌ | Local | `app/error.tsx` | **HIGH:** Has loading/not-found, but error unmounts workspace! |
| `/app/clients/[id]/edit` | `src/app/(app)/app/clients/[id]/edit/page.tsx` | Server (Async DB) | ❌ | ❌ | None | `app/error.tsx` | **HIGH:** Async client fetch has no loading or error |
| `/app/clients/[id]/bills` | `src/app/(app)/app/clients/[id]/bills/page.tsx` | Server (Async DB) | ✅ | ✅ | Local | Local | **EXEMPLARY:** Full skeleton and error boundary |
| `/portal` | `src/app/(portal)/portal/page.tsx` | Server (Async DB) | ❌ | ❌ | None | `app/error.tsx` | **HIGH:** Kirana dashboard has no loading skeleton or error boundary |
| `/portal/bills` | `src/app/(portal)/portal/bills/page.tsx` | Server (Async DB) | ✅ | ✅ | Local | Local | **EXEMPLARY:** Full skeleton and error boundary |

---

### 6.2 Critical State Gaps Explained

#### 1. Missing Layout-Level Error Boundary in Workspace (`(app)/app`)
- If an error throws in `/app/clients/[id]` (e.g. Supabase transient connection timeout), there is no `src/app/(app)/app/error.tsx`.
- The error bubbles directly to the root `src/app/error.tsx`.
- **Result:** The entire accountant navigation header, firm name, client selector, and sidebar disappear, replaced by the generic root error page.
- **Fix:** Add `src/app/(app)/app/error.tsx` that renders an error card inside the accountant workspace layout, preserving the top navigation and allowing the accountant to navigate to other clients without reloading the app.

#### 2. Missing Loading Skeleton on Kirana Shop Owner Portal (`/portal`)
- `src/app/(portal)/portal/page.tsx` executes multiple asynchronous server tasks: `connection()`, `requireClientAccess()`, query for client details across businesses, `getDocumentStatusCounts()`, and `listDocuments()`.
- On slow mobile networks (2G/3G in rural Kirana settings), the merchant sees a completely blank screen until all promises resolve.
- **Fix:** Create `src/app/(portal)/portal/loading.tsx` containing pulse skeletons for the business header, "Add bills" card, and 4 summary metric tiles.

#### 3. Missing Root `loading.tsx` and `global-error.tsx`
- Root `src/app/layout.tsx` has `src/app/error.tsx`, but Next.js App Router rules require `src/app/global-error.tsx` to handle errors thrown by the root layout itself.
- Root lacks a fallback `loading.tsx` for initial page transitions.

#### 4. Missing Page Metadata Titles (8 Routes)
A scan of metadata exports revealed that 8 routes export **no title metadata**:
- `/login`
- `/signup`
- `/forgot-password`
- `/reset-password`
- `/invite/[token]`
- `/portal`
- `/portal/bills`
- `/no-access`

**Impact:** The browser tab for these critical pages displays the raw root fallback:
`GST Saathi - GST compliance platform for accountants and the small shops they serve in India`.
A merchant reviewing bills in the Kirana portal sees an accountant-marketing title rather than `"Bills | GST Saathi"` or `"Shop Owner Portal"`.

---

## 7. Form Pending & Button Loading Feedback Audit

Forms across the application were inspected for submission state feedback (`isPending`, `useFormStatus`, `aria-busy`):

| Form Surface | Component / Action | Pending State Feedback | ARIA Busy / Disabled | Rating |
|---|---|---|---|:---:|
| `/login` | `LoginForm` (Password & OTP) | Yes (`isPending` toggles button text & disables inputs) | Form inputs disabled during submission | **PASS** |
| `/signup` | `SignupForm` | Yes (`isPending` disables `SubmitButton`) | `aria-busy={isPending}`, live error region | **PASS** |
| `/forgot-password` | Password Reset Form | Yes (`isPending` disables inputs) | Accessible live status region | **PASS** |
| `/reset-password` | Password Update Form | Yes (`isPending` disables submit) | Password inputs disabled | **PASS** |
| `/app/clients/new` | `ClientFormFields` | Yes (`isPending` changes text to `"Adding client..."`) | Button disabled while pending | **PASS** |
| `/app/clients/[id]/edit` | `ClientFormFields` | Yes (`isPending` changes text to `"Saving..."`) | Button disabled while pending | **PASS** |
| `src/app/(auth)/invite/[token]/page.tsx` | Step 1 (`sendInviteOtpAction`) & Step 2 (`verifyAndAcceptInviteAction`) | **NO FEEDBACK** | Standard `<Button type="submit">` without pending state or spinner | **FAIL** |
| `src/app/(app)/app/layout.tsx` | Logout action form | **NO FEEDBACK** | `<button type="submit">Log out</button>` has no disabled or pending indicator | **ADVISORY** |
| `src/app/(portal)/portal/layout.tsx` | Logout action form | **NO FEEDBACK** | `<button type="submit">Log out</button>` has no disabled or pending indicator | **ADVISORY** |

---

## 8. Prioritized Remediation Plan

### Phase 1: High Severity / Security & Trust (Immediate)

- [ ] **P0-1: Remove Dev Preview quick bypass from `/login`**  
  *Target:* `src/app/(auth)/login/page.tsx:64-89`  
  *Action:* Remove lines 64?"89 or wrap with `if (process.env.NODE_ENV === 'development')`.
- [ ] **P0-2: Replace `hello@example.com` with official support email**  
  *Target:* `src/config/site.ts:29`  
  *Action:* Update `contactEmail` to `support@gstsaathi.in` (or relevant production domain) so that mailto links on `<Footer />`, `<FinalCta />`, `/terms`, and `/privacy` do not lead to a dummy domain.
- [ ] **P0-3: Fix relative anchor links in `<Header />` and `<Footer />`**  
  *Target:* `src/config/site.ts:32-33`  
  *Action:* Change `href: "#how-it-works"` to `href: "/#how-it-works"` and `href: "#for-accountants"` to `href: "/#for-accountants"` to prevent dead anchor clicks from sub-pages like `/privacy` and `/terms`.
- [ ] **P0-4: Add missing legal links to global `<Footer />`**  
  *Target:* `src/components/layout/Footer.tsx:38-57`  
  *Action:* Add `<Link href="/terms">Terms of Service</Link>` and `<Link href="/privacy">Privacy Policy</Link>`.

---

### Phase 2: UX Completeness & State Resilience (Sprint 1)

- [ ] **P1-1: Add `(app)/app/error.tsx` workspace error boundary**  
  *Target:* `src/app/(app)/app/error.tsx`  
  *Action:* Prevent sub-page errors in accountant workspace from destroying the outer layout and top navigation shell.
- [ ] **P1-2: Add `(portal)/portal/loading.tsx` and `(portal)/portal/error.tsx`**  
  *Target:* `src/app/(portal)/portal/loading.tsx`, `src/app/(portal)/portal/error.tsx`  
  *Action:* Provide mobile-optimized pulse skeletons and retry boundaries for Kirana merchants on variable cellular data.
- [ ] **P1-3: Add metadata titles to all 8 un-titled routes**  
  *Target:* `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/invite/[token]`, `/portal`, `/portal/bills`, `/no-access`  
  *Action:* Export explicit `Metadata` with user-friendly page titles.
- [ ] **P1-4: Update Root Layout Title Template**  
  *Target:* `src/app/layout.tsx:12-15`  
  *Action:* Configure `title: { default: 'GST Saathi – ...', template: '%s | GST Saathi' }`.
- [ ] **P1-5: Align Hero CTA with Self-Serve Registration**  
  *Target:* `src/components/sections/Hero.tsx:17-19`  
  *Action:* Switch primary CTA from `#contact` (mailto early access) to `/signup` (`Create account`).
- [ ] **P1-6: Replace native `<a>` tag with Next.js `<Link>` on Invite page**  
  *Target:* `src/app/(auth)/invite/[token]/page.tsx:156-162`  
  *Action:* Prevent full browser reload on `"Use a different email"`.

---

### Phase 3: Polish & Future Gating (Sprint 2)

- [ ] **P2-1: Standardize WhatsApp invite copy**  
  *Target:* `src/components/clients/OwnerAccess.tsx:183`  
  *Action:* Consume `CLIENT_MESSAGES.ownerAccess.whatsAppText` instead of defining a separate hardcoded string.
- [ ] **P2-2: Gate or clean "Coming next" tabs in `DetailTabs.tsx`**  
  *Target:* `src/components/clients/DetailTabs.tsx:229-245`  
  *Action:* Clean internal milestone language from `scopeNotice` or hide unimplemented tabs until backend processing connects.
- [ ] **P2-3: Add pending feedback to Invite OTP submission buttons**  
  *Target:* `src/app/(auth)/invite/[token]/page.tsx:118, 152`  
  *Action:* Use `useFormStatus` or React 19 `useActionState` to disable buttons and show `"Sending..."` / `"Verifying..."`.
- [ ] **P2-4: Disclose physical address for DPDP Grievance Officer**  
  *Target:* `src/app/privacy/page.tsx:212`  
  *Action:* Add registered legal office address in India to satisfy statutory DPDP/IT Act requirements alongside the grievance email.

---
*End of Audit Report ?" Lane H (UX, Copy & State Completeness)*
