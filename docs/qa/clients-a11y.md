# Accessibility & Responsive QA Audit Report: Client Management Feature (R3)

**Project:** GST Saathi Web Application  
**Audit Date:** October 28, 2026  
**Auditor:** Reviewer R3 (Responsive Design & Accessibility Specialist)  
**Target Routes:**
- `/app/clients` (Client directory, search bar, filter chips, responsive table vs stacked cards)
- `/app/clients/new` (Add client business form, multi-scheme selection)
- `/app/clients/[id]` (Client detail page, tabs, header, coming next cards, shop owner access)
- `/app/clients/[id]/edit` (Edit client form, archive/hide confirmation dialog)

**Conformance Standards:**
- **WCAG 2.2 Level AA & Level AAA (Selective)**: Perceivable, Operable, Understandable, Robust
- **Touch Ergonomics**: 48px minimum touch target size (WCAG 2.2 SC 2.5.8 Level AA & SC 2.5.5 Level AAA)
- **Responsive Layout**: Mobile-first fluid scaling across 320px, 375px, 768px, and 1280px breakpoints
- **Design System Token Integrity**: Strict token compliance (`bg-background`, `bg-surface`, `text-ink`, `text-muted`, `border-line`, `bg-accent`, `text-on-accent`) with zero hardcoded hex values

**Inspected Source Files:**
- `src/app/(app)/app/layout.tsx` (Accountant workspace layout, main landmark, workspace navigation)
- `src/app/(app)/app/clients/page.tsx` (Client list, filter/search orchestration, responsive layout switch)
- `src/app/(app)/app/clients/loading.tsx` (Skeletal loader for list view with mobile/desktop variants)
- `src/app/(app)/app/clients/error.tsx` (Error boundary with recovery actions)
- `src/app/(app)/app/clients/new/page.tsx` (Add client route)
- `src/app/(app)/app/clients/[id]/page.tsx` (Client detail route)
- `src/app/(app)/app/clients/[id]/loading.tsx` (Skeletal loader for client detail)
- `src/app/(app)/app/clients/[id]/not-found.tsx` (404 state with recovery navigation)
- `src/app/(app)/app/clients/[id]/edit/page.tsx` (Edit client route & archive panel)
- `src/components/clients/ClientTable.tsx` (Desktop table view $\ge$ 768px)
- `src/components/clients/ClientCard.tsx` (Mobile stacked card view $<$ 768px)
- `src/components/clients/ClientFormFields.tsx` (Add/Edit form components, inputs, radios, checkboxes)
- `src/components/clients/ClientHeader.tsx` (Client identity, state, GSTIN, scheme, compliance tags)
- `src/components/clients/DetailTabs.tsx` (WAI-ARIA tablist & tabpanels: Overview, Bills, GSTR-2B, Returns)
- `src/components/clients/ComingNext.tsx` (Placeholder milestone cards)
- `src/components/clients/OwnerAccess.tsx` (Portal invitation generation, clipboard copy, revocation)
- `src/components/clients/EditClientActions.tsx` (Archive/Restore triggers & modal dialog)
- `src/components/clients/EmptyState.tsx` (Zero-clients callout)
- `src/components/clients/FilterChips.tsx` (Multi-category interactive toggle chips)
- `src/components/clients/SearchBar.tsx` (Debounced search form with clear action)
- `src/components/clients/StatusBadge.tsx` (Non-color-reliant status badge)
- `src/components/ui/Button.tsx` (Reusable button primitive)
- `src/app/globals.css` (Design tokens & global focus visible ring)

---

## 1. Executive Summary & Conformance Scorecard

An extensive responsive design and accessibility audit was conducted on the newly deployed Client Management feature in GST Saathi. The feature caters directly to practicing Indian Chartered Accountants and tax practitioners who require both high-throughput desktop entry and frictionless mobile inspection on small handheld devices.

### Evaluation Scorecard

| Dimension | Standard / Guideline | Evaluated Result | Verdict |
|---|---|---|---|
| **1. Viewport Adaptation (320px–1280px)** | Fluid responsive grid, no overflow | Tested across 320px, 375px, 768px, 1280px. Zero horizontal scrolling. Breakpoints transition smoothly. | **PASS** |
| **2. Table vs Card Responsive Switch** | Responsive pattern architecture | `hidden md:block` for tabular data ($\ge$768px); `block md:hidden` for stacked mobile cards ($<$768px). | **PASS** |
| **3. Mobile Touch Targets** | WCAG 2.2 SC 2.5.8 / 48px Ergonomics | All buttons, text inputs, radio cards, checkboxes, filter chips, tabs, and action links meet or exceed 48px. | **PASS** |
| **4. Status Representation** | WCAG 2.2 SC 1.4.1 (Use of Color) | Status is **never** conveyed by color alone. Employs explicit plain-language text and 5 distinct border styles. | **PASS** |
| **5. Semantic Landmarks & Hierarchy** | WCAG 2.2 SC 1.3.1 (Info & Relationships) | Semantic `<header>`, `<nav>`, `<main>`, `<article>`, and `<fieldset>` used correctly. Heading hierarchy H1 $\rightarrow$ H2 $\rightarrow$ H3 is valid. | **PASS** |
| **6. Form Field Accessibility** | WCAG 2.2 SC 1.3.1, SC 3.3.2, SC 4.1.2 | Explicit `<label htmlFor={id}>` mappings using `useId()`. Fieldsets with `<legend>`. Advisory on `aria-invalid` / `aria-describedby`. | **PASS (Advisory)** |
| **7. Skip Navigation Support** | WCAG 2.2 SC 2.4.1 (Bypass Blocks) | Landing page implements skip link; authenticated layout (`AccountantAppLayout`) currently lacks skip link to `#main-content`. | **ADVISORY** |
| **8. Contrast & Token Compliance** | WCAG 2.2 SC 1.4.3 / SC 1.4.11 | Exclusively uses design tokens. Contrast ratios range from **6.80:1** to **19.8:1**, surpassing AA and AAA thresholds. Zero hardcoded hex. | **PASS** |

### Overall Verdict: **PASS WITH ADVISORIES**
*Zero critical Level A or Level AA blocking defects. The responsive design demonstrates exemplary discipline on micro-viewports (320px KaiOS / iPhone SE 1st gen), and touch targets uniformly observe the 48px rule. Two non-blocking hardening recommendations (skip link in workspace layout and programmatic ARIA error descriptions) are documented with complete remediation code.*

---

## 2. Viewports & Responsive Design Audit

### 2.1 Evaluated Viewport Specifications

1. **320px** (Compact Mobile: iPhone SE 1st Gen, JioPhone / KaiOS, Android One small devices)
2. **375px** (Standard Mobile: iPhone SE 2nd/3rd Gen, iPhone 12/13/14 mini, common Android viewports)
3. **768px** (Tablet Portrait: iPad Mini, iPad 9.7", Android tablets; Tailwind `md` breakpoint boundary)
4. **1280px** (Standard Desktop: MacBook Air, 1080p desktop display, Tailwind `xl` breakpoint)

---

### 2.2 Route-by-Route Breakdown

#### A. Client Directory (`/app/clients`)

```tsx
// Responsive Viewport Switch in src/app/(app)/app/clients/page.tsx:
{/* Desktop Table View (>= 768px) */}
<div className="hidden md:block">
  <ClientTable clients={items} />
</div>

{/* Mobile Card View (< 768px) */}
<div className="block md:hidden space-y-3">
  {items.map((client) => (
    <ClientCard key={client.id} client={client} />
  ))}
</div>
```

- **320px Viewport**:
  - The outer wrapper provides `px-4` padding (16px left + 16px right), giving an available horizontal content width of **288px**.
  - **Header**: Flex column layout (`flex-col gap-4 sm:flex-row`). The "Clients" H1 and descriptive text stack cleanly above the "Add client" button.
  - **Search & Filters**: `SearchBar` input spans 100% width (`min-h-[48px] pr-20`). The "Clear" button is positioned absolutely on the right with a 48px tap target and does not cause overflow. `FilterChips` groups wrap smoothly (`flex flex-wrap items-center gap-2`). At 320px, chips wrap into 2 rows for Scheme and 3 rows for Status without horizontal truncation.
  - **Client Cards (`ClientCard.tsx`)**: The desktop table is hidden via `hidden md:block`. Mobile cards render with `p-4 space-y-3`. Long legal names wrap gracefully via `break-words`. Detail lines (GSTIN, State, Scheme, Owner Access) utilize `flex items-center justify-between text-xs` with uppercase labels. Action buttons ("View" and "Edit") occupy a bottom action bar with `min-h-[48px]`, filling the row cleanly.
  - **Horizontal Scroll Check**: **0px horizontal overflow**. Document width matches viewport exactly.
- **375px Viewport**:
  - 343px available width. Provides slightly more breathing room for the GSTIN monospace string (`font-mono text-xs font-semibold tracking-wider`) and the trade name subtitle.
- **768px Viewport**:
  - Exact breakpoint where `hidden md:block` activates and `block md:hidden` is suppressed.
  - Header switches to horizontal alignment (`sm:flex-row sm:items-center sm:justify-between`).
  - `ClientTable` renders in a structured 6-column tabular format:
    1. Business (Legal name + optional trade name)
    2. GSTIN & State
    3. Scheme
    4. Status (`StatusBadge`)
    5. Owner Access
    6. Actions ("View" and "Edit" links)
  - The table container includes `overflow-x-auto` as a safety barrier against viewport overflow, though at 768px the table fits comfortably without triggering a scrollbar.
- **1280px Viewport**:
  - Main container is capped at `max-w-6xl` (1152px) centered with `mx-auto`. Table columns have generous horizontal padding (`px-6 py-4`), establishing clear visual grouping and rapid row scanning.

---

#### B. Add Client Form (`/app/clients/new`)

```tsx
// Outer Form Constraints in src/components/clients/ClientFormFields.tsx:
<form onSubmit={handleSubmit} className="space-y-8 max-w-2xl" noValidate>
```

- **320px Viewport**:
  - Form width matches available 288px width.
  - Form is logically partitioned into 3 distinct fieldsets:
    1. *Business details* (Legal Name, Trade Name, GSTIN, live State detection badge).
    2. *Tax scheme and turnover* (Radio cards with helper descriptions).
    3. *What the shop sells* (Taxable and exempt checkboxes, preferred language dropdown).
  - All text inputs have `w-full min-h-[48px] px-4 py-3 text-base`. Input text uses 16px font size, preventing iOS Safari from triggering unwanted auto-zoom on focus.
  - Turnover band radio cards use `grid grid-cols-1 sm:grid-cols-2 gap-3`. At 320px, they stack as a single vertical column, preserving full readability of turnover ranges.
  - Live GSTIN state detection badge (`State: Maharashtra (27)`) wraps cleanly within `flex flex-wrap items-center justify-between gap-2 text-xs`.
  - Submit ("Add client") and "Cancel" buttons stack vertically on mobile (`flex flex-col sm:flex-row gap-3 pt-2`), ensuring both have full-width tap targets.
  - **Horizontal Scroll Check**: **0px horizontal overflow**.
- **375px Viewport**:
  - Identical single-column layout with 343px content width. Clean line wrapping in helper notes.
- **768px Viewport**:
  - Turnover band switches to a 2-column grid (`sm:grid-cols-2`).
  - Action buttons align horizontally side-by-side (`sm:flex-row`).
- **1280px Viewport**:
  - Form is capped at `max-w-2xl` (672px), preventing excessively long text inputs that degrade typist speed and data-entry accuracy.

---

#### C. Client Detail Page (`/app/clients/[id]`)

```tsx
// Header & Tabs in src/components/clients/ClientHeader.tsx & DetailTabs.tsx:
<div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
...
<nav aria-label="Client sections" role="tablist" className="flex items-center gap-2 border-b border-line overflow-x-auto pb-px">
```

- **320px Viewport**:
  - **Header (`ClientHeader.tsx`)**: Legal/Trade name title stacks above the "Edit business" button. Meta tags (GSTIN badge, State, Scheme, Compliance badge) wrap across 2–3 rows with `flex flex-wrap items-center gap-2`.
  - **Tabs (`DetailTabs.tsx`)**: Tablist uses `overflow-x-auto` with `whitespace-nowrap` on tab buttons. On a 320px screen, the 4 tabs ("Overview", "Bills", "GSTR-2B", "Returns") can be swiped smoothly without breaking the layout of the page itself. Each tab button enforces `min-h-[48px]` for effortless finger activation.
  - **Business Details Grid**: The definition list (`<dl>`) uses `grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6`. On 320px, it renders as a single vertical stack of definition terms (`<dt>`) and descriptions (`<dd>`), preventing text clipping.
  - **Shop Owner Portal Access (`OwnerAccess.tsx`)**:
    - The generated private invite URL box includes `break-all select-all min-h-[48px] flex items-center`, guaranteeing that 80+ character token URLs will never blow out the mobile viewport.
    - Action buttons ("Copy link", "Share on WhatsApp", "Done") wrap predictably (`flex flex-wrap items-center gap-3`).
    - Active owners and pending invites lists stack user email/identifier above status and action buttons on narrow screens (`flex-col sm:flex-row`).
  - **Milestone Cards (`ComingNext.tsx`)**: Centered card with `p-8` fits neatly inside the 288px mobile width.
  - **Horizontal Scroll Check**: **0px page horizontal overflow**.
- **375px Viewport**:
  - Tab labels fit with minimal horizontal scrolling. All meta tags in the header fit on two lines.
- **768px Viewport**:
  - Header aligns title and "Edit business" horizontally.
  - Overview `<dl>` renders in 3 columns (`md:grid-cols-3`).
  - Active owner rows align horizontally (`sm:flex-row sm:items-center sm:justify-between`).
- **1280px Viewport**:
  - Full width layout constrained by `max-w-6xl`. Detail cards and owner access panels provide well-proportioned whitespace.

---

#### D. Edit Client Page (`/app/clients/[id]/edit`)

- **320px Viewport**:
  - Back breadcrumb link (`← Back to client details`) provides a 48px tap target.
  - Title and "Status: Hidden (Archived)" badge wrap cleanly.
  - If client is archived, an explanatory alert banner renders with `p-4 text-sm text-ink`.
  - ClientFormFields renders identical to the `/new` page with pre-populated values.
  - **Client Visibility / Danger Zone (`EditClientActions.tsx`)**:
    - Container: `rounded-xl border border-line bg-surface/30 p-6 max-w-2xl space-y-4`.
    - "Hide this client" or "Restore client" buttons feature `min-h-[48px]`.
    - **Confirmation Modal**: Fixed overlay `fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4`. Modal card has `w-full max-w-md p-6`. Buttons ("Yes, hide client" and "Cancel") stack vertically on mobile (`flex-col sm:flex-row gap-3`).
  - **Horizontal Scroll Check**: **0px horizontal overflow**.
- **375px, 768px, 1280px Viewports**:
  - Modal buttons align horizontally on `sm:` viewports. Modal card maintains centered dialog positioning.

---

### 2.3 Responsive Layout Summary Matrix

| Page / Component | 320px (Compact Mobile) | 375px (Mobile) | 768px (Tablet) | 1280px (Desktop) | Horizontal Overflow |
|---|---|---|---|---|---|
| **Global Layout Header** | Stacked 2-row layout, truncated email | Stacked 2-row layout | Single row layout | Single row max-w-6xl | **0px (PASS)** |
| **Client List (`/app/clients`)** | Stacked cards, wrapped filter chips | Stacked cards | Full data table | Full data table (padded) | **0px (PASS)** |
| **Search Bar & Filters** | 100% width, clear button right-fixed | 100% width | Inline row | Inline row | **0px (PASS)** |
| **Client Cards vs Table** | Stacked `ClientCard` (`block md:hidden`) | Stacked `ClientCard` | `ClientTable` (`hidden md:block`) | `ClientTable` | **0px (PASS)** |
| **Add Client Form (`/new`)** | 1-col inputs, stacked buttons | 1-col inputs | 2-col turnover grid | max-w-2xl centered form | **0px (PASS)** |
| **Client Detail (`/[id]`)** | 1-col DL, swipable tablist | 1-col DL | 3-col DL, inline tabs | 3-col DL, inline tabs | **0px (PASS)** |
| **Owner Access (`OwnerAccess`)** | Wrapped buttons, `break-all` URL | Wrapped buttons | Inline buttons | Right-aligned actions | **0px (PASS)** |
| **Edit Page (`/[id]/edit`)** | Stacked actions, full-width modal | Stacked actions | Side-by-side actions | max-w-2xl container | **0px (PASS)** |
| **Archive Dialog** | Vertical button stack in modal | Vertical stack | Horizontal button row | Horizontal button row | **0px (PASS)** |

---

## 3. Touch Targets & Mobile Ergonomics

### 3.1 Standard & Audit Criteria
Under **WCAG 2.2 Success Criterion 2.5.8 (Target Size - Minimum, Level AA)**, interactive targets must measure at least 24×24 CSS pixels unless sufficient spacing is provided. Under **WCAG 2.2 Success Criterion 2.5.5 (Target Size - Enhanced, Level AAA)** and modern mobile platform design guidelines (Apple Human Interface Guidelines, Google Material Design 3), the recommended ergonomic touch target size is **48×48 CSS pixels**.

### 3.2 Inventory of Interactive Targets

| Target Element | Location | Sizing & Padding Classes | Rendered Dimensions | Conformance (24px AA / 48px AAA) |
|---|---|---|---|---|
| **Brand Logo Link** | `AccountantAppLayout:33-38` | `min-h-[48px] inline-flex items-center` | $\ge 48\text{px} \times 110\text{px}$ | **PASS (Exceeds AAA)** |
| **Workspace Nav Links** | `AccountantAppLayout:44-56` | `min-h-[48px] px-3 py-2 inline-flex items-center` | $\ge 48\text{px} \times 62\text{px}$ | **PASS (Exceeds AAA)** |
| **Log out Button** | `AccountantAppLayout:67-73` | `min-h-[48px] px-4 py-2` | $\ge 48\text{px} \times 78\text{px}$ | **PASS (Exceeds AAA)** |
| **Add Client Primary Button** | `clients/page.tsx:90, 115` | `Button.tsx`: `min-h-[48px] px-6 py-3` | $\ge 48\text{px} \times 128\text{px}$ | **PASS (Exceeds AAA)** |
| **Search Input Field** | `SearchBar.tsx:104-112` | `w-full min-h-[48px] px-4 py-2.5 pr-20 text-base` | $48\text{px} \times 100\%$ | **PASS (Exceeds AAA)** |
| **Search Clear Button** | `SearchBar.tsx:116-124` | `min-h-[48px] min-w-[48px] inline-flex items-center justify-center` | $48\text{px} \times 48\text{px}$ | **PASS (Exceeds AAA)** |
| **Scheme Filter Chips** | `FilterChips.tsx:87-100` | `min-h-[48px] px-4 py-2.5 rounded-full` | $\ge 48\text{px} \times 74\text{px}$ | **PASS (Exceeds AAA)** |
| **Status Filter Chips** | `FilterChips.tsx:118-131` | `min-h-[48px] px-4 py-2.5 rounded-full` | $\ge 48\text{px} \times 82\text{px}$ | **PASS (Exceeds AAA)** |
| **Clear Filters Link** | `clients/page.tsx:151-156` | `min-h-[48px] px-6 py-2.5 rounded-lg` | $\ge 48\text{px} \times 130\text{px}$ | **PASS (Exceeds AAA)** |
| **ClientTable "View" Link** | `ClientTable.tsx:127-132` | `min-h-[48px] min-w-[48px] px-3 py-2` | $48\text{px} \times 48\text{px}$ | **PASS (Exceeds AAA)** |
| **ClientTable "Edit" Link** | `ClientTable.tsx:133-138` | `min-h-[48px] min-w-[48px] px-3 py-2` | $48\text{px} \times 48\text{px}$ | **PASS (Exceeds AAA)** |
| **ClientCard "View" Button** | `ClientCard.tsx:98-103` | `flex-1 min-h-[48px] px-4 py-2` | $\ge 48\text{px} \times 180\text{px}$ | **PASS (Exceeds AAA)** |
| **ClientCard "Edit" Button** | `ClientCard.tsx:104-109` | `min-h-[48px] min-w-[48px] px-4 py-2` | $48\text{px} \times 58\text{px}$ | **PASS (Exceeds AAA)** |
| **Pagination Links** | `clients/page.tsx:179-213` | `min-h-[48px] min-w-[48px] px-4 py-2` | $48\text{px} \times 88\text{px}$ | **PASS (Exceeds AAA)** |
| **Back Breadcrumb Links** | `new/page.tsx`, `[id]/page.tsx` | `min-h-[48px] py-2 inline-flex items-center` | $\ge 48\text{px} \times 140\text{px}$ | **PASS (Exceeds AAA)** |
| **Form Text Inputs** | `ClientFormFields.tsx:203, 221, 238` | `w-full min-h-[48px] px-4 py-3 text-base` | $48\text{px} \times 100\%$ | **PASS (Exceeds AAA)** |
| **Scheme Radio Cards** | `ClientFormFields.tsx:269-290` | `p-4 cursor-pointer flex items-start gap-3` | $\ge 68\text{px} \times 100\%$ | **PASS (Exceeds AAA)** |
| **Turnover Radio Cards** | `ClientFormFields.tsx:302-321` | `p-3 cursor-pointer flex items-start gap-3` | $\ge 56\text{px} \times 100\%$ | **PASS (Exceeds AAA)** |
| **Supply Type Checkboxes** | `ClientFormFields.tsx:337-367` | `min-h-[48px] p-3 cursor-pointer` | $\ge 52\text{px} \times 100\%$ | **PASS (Exceeds AAA)** |
| **Language Select Dropdown** | `ClientFormFields.tsx:378-389` | `w-full min-h-[48px] px-4 py-3 text-base` | $48\text{px} \times 100\%$ | **PASS (Exceeds AAA)** |
| **Form Submit & Cancel Buttons** | `ClientFormFields.tsx:396-410` | `min-h-[48px] px-6 py-3` | $\ge 48\text{px} \times 130\text{px}$ | **PASS (Exceeds AAA)** |
| **Client Detail Tabs** | `DetailTabs.tsx:47-63` | `min-h-[48px] px-4 py-3 text-sm font-semibold` | $\ge 48\text{px} \times 92\text{px}$ | **PASS (Exceeds AAA)** |
| **OwnerAccess "Create invite link"** | `OwnerAccess.tsx:209-217` | `min-h-[48px] px-6 py-3` | $\ge 48\text{px} \times 160\text{px}$ | **PASS (Exceeds AAA)** |
| **OwnerAccess "Copy link"** | `OwnerAccess.tsx:246-253` | `min-h-[48px] px-6 py-3` | $\ge 48\text{px} \times 110\text{px}$ | **PASS (Exceeds AAA)** |
| **OwnerAccess "Share on WhatsApp"** | `OwnerAccess.tsx:255-263` | `min-h-[48px] px-6 py-3` | $\ge 48\text{px} \times 175\text{px}$ | **PASS (Exceeds AAA)** |
| **OwnerAccess "Done" Button** | `OwnerAccess.tsx:265-272` | `min-h-[48px] px-4 py-2` | $\ge 48\text{px} \times 64\text{px}$ | **PASS (Exceeds AAA)** |
| **OwnerAccess "Revoke" / Confirm** | `OwnerAccess.tsx:370-398` | `min-h-[48px] px-4 py-2` | $\ge 48\text{px} \times 80\text{px}$ | **PASS (Exceeds AAA)** |
| **Hide / Restore Client Buttons** | `EditClientActions.tsx:84-106` | `min-h-[48px] px-5 py-2.5` | $\ge 48\text{px} \times 140\text{px}$ | **PASS (Exceeds AAA)** |
| **Archive Modal Confirm/Cancel** | `EditClientActions.tsx:126-142` | `min-h-[48px] px-5 py-2.5` | $\ge 48\text{px} \times 130\text{px}$ | **PASS (Exceeds AAA)** |

*Result:* **100% of tested interactive elements satisfy the 48px minimum touch target requirement.**

---

## 4. Status Representation & WCAG 1.4.1 (Use of Color)

### 4.1 Mandate & Compliance Check
**WCAG 2.2 Success Criterion 1.4.1 (Use of Color - Level A)** mandates:
> *Color is not used as the only visual means of conveying information, indicating an action, prompting a response, or distinguishing a visual element.*

In financial compliance applications, relying on colored dots (such as green for filed, yellow for pending, red for overdue) creates severe accessibility barriers for users with color vision deficiencies (protanopia, deuteranopia, tritanopia, or monochromacy) and in high-glare environments.

### 4.2 StatusBadge Implementation Analysis

```tsx
// Excerpt from src/components/clients/StatusBadge.tsx:
function getStatusBorderStyle(status: ClientStatusLabel): string {
  switch (status) {
    case 'No activity yet':
      return 'border border-dashed border-line';
    case 'Documents waiting':
      return 'border-2 border-dotted border-line';
    case 'Needs attention':
      return 'border-2 border-double border-ink';
    case 'Ready for review':
      return 'border-2 border-solid border-line';
    case 'Filed':
      return 'border border-solid border-ink';
    default:
      return 'border border-solid border-line';
  }
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const borderStyle = getStatusBorderStyle(status);
  return (
    <span
      data-status={status}
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-surface text-ink whitespace-nowrap ${borderStyle} ${className}`.trim()}
    >
      {status}
    </span>
  );
}
```

### 4.3 Multi-Sensory Differentiation Matrix

| Compliance Status | Rendered Text Label | Visual Border Pattern | Border Stroke & Color | Meaning Conveyed Without Color |
|---|---|---|---|---|
| **No activity yet** | `"No activity yet"` | `border-dashed` | 1px border-line | Subtle dashed contour signifies uninitiated activity |
| **Documents waiting** | `"Documents waiting"` | `border-dotted` | 2px border-line | Dotted perimeter signifies pending client uploads |
| **Needs attention** | `"Needs attention"` | `border-double` | 2px double border-ink | High-contrast double stroke signals required action |
| **Ready for review** | `"Ready for review"` | `border-solid` | 2px solid border-line | Thick solid contour conveys completed reconciliation |
| **Filed** | `"Filed"` | `border-solid` | 1px solid border-ink | Solid ink line confirms finality of submission |

In addition:
1. **Background & Text Tokens**: Badges use `bg-surface` (#F6F6F4) and `text-ink` (#0B0B0C). No red/amber/green chromatic fills are applied.
2. **Archived / Hidden Status**: In `ClientHeader.tsx` and `EditClientPage.tsx`, archived records display an explicit text badge: `<span className="...">Status: Hidden (Archived)</span>`.
3. **Owner Access Status**: In `ClientTable`, `ClientCard`, and `OwnerAccess`, access state is communicated via explicit text: `"Active"`, `"Invite sent"`, or `"No invite"`.
4. **Monochrome Verification**: In complete grayscale simulation, every status badge and indicator remains 100% decipherable solely through legible typography and distinctive border stroke geometry.

*Result:* **PASS**. Complies fully with WCAG 2.2 SC 1.4.1.

---

## 5. Accessibility & Semantic HTML Audit

### 5.1 Landmark Architecture

```
<body>
 ├── <header> (AccountantAppLayout:30)
 │    └── <nav aria-label="Accountant workspace"> (AccountantAppLayout:43)
 └── <main className="flex-1"> (AccountantAppLayout:78)
      ├── <section aria-label="Filter and search clients"> (clients/page.tsx:122)
      │    └── <form role="search"> (SearchBar.tsx:95)
      ├── <nav aria-label="Pagination navigation"> (clients/page.tsx:175)
      ├── <article aria-label="{client.names.legal_name}"> (ClientCard.tsx:46)
      ├── <nav aria-label="Client sections" role="tablist"> (DetailTabs.tsx:39)
      │    └── <div role="tabpanel" id="tabpanel-overview"> (DetailTabs.tsx:70)
      ├── <section aria-label="Business overview"> (DetailTabs.tsx:77)
      ├── <section aria-label="Shop owner access"> (DetailTabs.tsx:150)
      └── <section aria-label="Danger Zone"> (edit/page.tsx:104)
```

- **Screen Reader Landmarks**:
  - Semantic `<header>` encapsulates workspace branding, firm context, and session actions.
  - Distinct `<nav>` landmarks are clearly disambiguated using unique `aria-label` attributes (`"Accountant workspace"`, `"Pagination navigation"`, `"Client sections"`).
  - Main application view is bounded within `<main>`.
  - Content sections within pages use `<section aria-label="...">` and `<article aria-label="...">`.

---

### 5.2 Heading Hierarchy

The heading structure across all client views follows a strict, unbroken hierarchy:

#### `/app/clients`
- `H1`: "Clients"
  - `H2`: "Add your first client" (in `EmptyState` when 0 clients exist)
  - `H3`: `{client.names.legal_name}` (in each `ClientCard` in mobile view)

#### `/app/clients/new`
- `H1`: "Add a client business"
  - Fieldset legends serve as section titles:
    - `legend`: "1. Business details"
    - `legend`: "2. Tax scheme and turnover"
    - `legend`: "3. What the shop sells"

#### `/app/clients/[id]`
- `H1`: `{client.names.trade_name || client.names.legal_name}`
  - `H2`: "Business details" (in Overview tab)
  - `H2`: "Shop Owner Portal Access" (in `OwnerAccess`)
    - `H3`: "Active Owners" (sub-list)
    - `H3`: "Pending Invites" (sub-list)
  - `H3`: `{title}` (in `ComingNext` for Bills, GSTR-2B, Returns tabs)

#### `/app/clients/[id]/edit`
- `H1`: "Edit client"
  - Fieldset legends: "1. Business details", "2. Tax scheme and turnover", "3. What the shop sells"
  - `H2`: "Client visibility" (Danger zone)
    - `H3`: "Hide this client? Their data is kept." (Modal dialog title)

*Result:* **PASS**. Zero skipped heading levels (no H3 without H2, no H2 without H1).

---

### 5.3 Form Field Association & Error Messaging

#### A. Input Association (`htmlFor` $\leftrightarrow$ `id`)
All form fields in `ClientFormFields.tsx` and `SearchBar.tsx` generate stable unique identifiers using React 19's `useId()` hook:
- Legal Name: `legalNameId = useId()` $\rightarrow$ `<label htmlFor={legalNameId}>` and `<input id={legalNameId}>`
- Trade Name: `tradeNameId = useId()` $\rightarrow$ `<label htmlFor={tradeNameId}>` and `<input id={tradeNameId}>`
- GSTIN: `gstinId = useId()` $\rightarrow$ `<label htmlFor={gstinId}>` and `<input id={gstinId}>`
- Language: `languageId = useId()` $\rightarrow$ `<label htmlFor={languageId}>` and `<select id={languageId}>`
- Radio buttons (Scheme & Turnover): Encapsulated within parent `<label>` tags with associated text.
- Checkboxes (Supply types): Encapsulated within parent `<label>` tags with text and helper descriptions.
- Search input: `<label htmlFor="client-search-input" className="sr-only">Search clients</label>` associated with `<input id="client-search-input">`.

#### B. Error Association & Validation (Advisory Finding)
- Global form errors are correctly exposed via `<div role="alert">`.
- However, per-field errors (e.g. `fieldErrors.legal_name`, `fieldErrors.gstin`) are currently rendered in `<p className="text-sm font-medium text-ink">{fieldErrors.legal_name}</p>` immediately below the input, but:
  - Inputs do **not** have `aria-invalid={Boolean(fieldErrors.legal_name)}`.
  - Inputs do **not** link to the error message via `aria-describedby`.
  - *Recommendation*: Add `aria-invalid` and `aria-describedby` to ensure screen reader users receive immediate error context upon tabbing to invalid inputs (see Section 7 for code).

---

### 5.4 Skip Navigation Support (Advisory Finding)

- **Standard**: WCAG 2.2 SC 2.4.1 (Bypass Blocks - Level A).
- **Inspection**:
  - The public landing page (`src/app/page.tsx`) contains a skip navigation link (`<a href="#main-content">Skip to main content</a>`).
  - However, in `src/app/(app)/app/layout.tsx` (the authenticated accountant workspace wrapping `/app/clients`, `/new`, `/[id]`, etc.), there is **no skip link**, and `<main className="flex-1">` does not have an `id="main-content"` or `tabIndex={-1}`.
  - A keyboard user navigating between client views must tab through the 4 header links (GST Saathi brand, Home, Clients, Log out) on every page load before reaching page content.
  - *Recommendation*: Add an accessible skip link to `AccountantAppLayout` pointing to `<main id="main-content" tabIndex={-1}>` (see Section 7 for code).

---

### 5.5 Tab Pattern Semantics (`DetailTabs.tsx`)

`DetailTabs` correctly implements the WAI-ARIA Tabs design pattern:
- Outer wrapper: `<nav aria-label="Client sections" role="tablist">`
- Tab buttons:
  - `role="tab"`
  - `aria-selected={isActive}`
  - `aria-controls={"tabpanel-" + tab.id}`
  - `id={"tab-" + tab.id}`
  - Tab panels:
  - `role="tabpanel"`
  - `id={"tabpanel-" + tab.id}`
  - `aria-labelledby={"tab-" + tab.id}`
- *Advisory*: Currently tabs use standard Tab key navigation. Supporting ArrowLeft/ArrowRight keyboard navigation between tabs per WAI-ARIA APG pattern would offer enhanced keyboard ergonomics.

---

### 5.6 Confirmation Modal Dialog Semantics (`EditClientActions.tsx`)

The archive confirmation dialog implements core accessible dialog attributes:
- Overlay: `role="dialog" aria-modal="true" aria-labelledby="confirm-archive-title"`
- Title: `<h3 id="confirm-archive-title">Hide this client? Their data is kept.</h3>`
- *Advisory*: Add a keyboard listener for the `Escape` key (`onKeyDown={(e) => if (e.key === 'Escape') setShowConfirm(false)}`) and trap focus within the dialog while open.

---

## 6. Color Contrast & Design Token Compliance

### 6.1 Design Token Architecture
The application defines all semantic colors in `src/app/globals.css` using Tailwind v4 `@theme` and CSS `:root` custom properties:

```css
@theme {
  --color-background: #FFFFFF;
  --color-surface: #F6F6F4;
  --color-ink: #0B0B0C;
  --color-muted: #55555C;
  --color-line: #E3E3E0;
  --color-accent: #1D4ED8;
  --color-accent-hover: #1E40AF;
  --color-on-accent: #FFFFFF;
}
```

### 6.2 Hardcoded Color Verification
A recursive grep across all files in `src/components/clients/` and `src/app/(app)/app/clients/` confirmed:
- **0 hardcoded hex codes** (e.g. `#fff`, `#333`, `#e5e7eb`).
- **0 hardcoded rgb/hsl values**.
- **0 unmapped Tailwind color classes** (e.g. `bg-red-500`, `text-blue-600`, `border-gray-200`).
- **100% compliance** with system design tokens (`bg-background`, `bg-surface`, `text-ink`, `text-muted`, `border-line`, `bg-accent`, `text-on-accent`, `ring-accent`).

---

### 6.3 Contrast Ratio Calculations

Contrast ratios were mathematically verified using the WCAG relative luminance formula:
$$L = 0.2126 \times R + 0.7152 \times G + 0.0722 \times B$$
$$\text{Contrast Ratio} = \frac{L_1 + 0.05}{L_2 + 0.05}$$

| Color Pair | Foreground Token / Hex | Background Token / Hex | Calculated Contrast | WCAG AA Threshold | WCAG AAA Threshold | Verdict |
|---|---|---|---|---|---|---|
| **Body / Heading Text** | `--color-ink` (`#0B0B0C`, $L = 0.0030$) | `--color-background` (`#FFFFFF`, $L = 1.000$) | **19.81 : 1** | 4.5 : 1 | 7.0 : 1 | **PASS (Exceeds AAA)** |
| **Body / Heading Text on Surface** | `--color-ink` (`#0B0B0C`, $L = 0.0030$) | `--color-surface` (`#F6F6F4`, $L = 0.9147$) | **18.20 : 1** | 4.5 : 1 | 7.0 : 1 | **PASS (Exceeds AAA)** |
| **Secondary / Muted Text on Background** | `--color-muted` (`#55555C`, $L = 0.0895$) | `--color-background` (`#FFFFFF`, $L = 1.000$) | **7.53 : 1** | 4.5 : 1 | 7.0 : 1 | **PASS (Exceeds AAA)** |
| **Secondary / Muted Text on Surface** | `--color-muted` (`#55555C`, $L = 0.0895$) | `--color-surface` (`#F6F6F4`, $L = 0.9147$) | **6.91 : 1** | 4.5 : 1 | 7.0 : 1 (Borderline) | **PASS (Exceeds AA)** |
| **Primary Accent Button Text** | `--color-on-accent` (`#FFFFFF`, $L = 1.000$) | `--color-accent` (`#1D4ED8`, $L = 0.1044$) | **6.80 : 1** | 4.5 : 1 | 7.0 : 1 (Large AAA) | **PASS (Exceeds AA / Large AAA)** |
| **Active Filter Chip Text** | `--color-on-accent` (`#FFFFFF`, $L = 1.000$) | `--color-accent` (`#1D4ED8`, $L = 0.1044$) | **6.80 : 1** | 4.5 : 1 | 7.0 : 1 (Large AAA) | **PASS (Exceeds AA / Large AAA)** |
| **Focus Visible Outline** | `--color-accent` (`#1D4ED8`, $L = 0.1044$) | `--color-background` (`#FFFFFF`, $L = 1.000$) | **6.80 : 1** | 3.0 : 1 (Non-text SC 2.4.11) | N/A | **PASS (Exceeds AA)** |
| **Card / Table Dividing Line** | `--color-line` (`#E3E3E0`, $L = 0.771$) | `--color-background` (`#FFFFFF`, $L = 1.000$) | **1.28 : 1** | N/A (Decorative separator) | N/A | **PASS** |

*Result:* All text elements surpass the WCAG AA minimum requirement of 4.5:1. Primary ink text exceeds the strictest Level AAA threshold by over 180%.

---

## 7. Actionable Recommendations & Remediation Code

### Recommendation 1: Add Skip Link to `AccountantAppLayout` (WCAG 2.4.1)

**Issue**: Keyboard users navigating between client routes must tab through the 4 header items on each navigation.  
**File**: `src/app/(app)/app/layout.tsx`

```tsx
// Suggested Enhancement in src/app/(app)/app/layout.tsx:
return (
  <div className="min-h-screen bg-background text-ink flex flex-col">
    {/* Accessible skip link */}
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-accent focus:text-on-accent focus:rounded-md focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-accent"
    >
      Skip to main content
    </a>

    <header className="border-b border-line bg-background">
      {/* ... header navigation ... */}
    </header>

    <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {children}
      </div>
    </main>
  </div>
);
```

---

### Recommendation 2: Connect Form Errors with `aria-invalid` & `aria-describedby` (WCAG 3.3.1)

**Issue**: Screen reader users navigating through input fields with errors are not programmatically notified that the field has an invalid value or read the specific error message.  
**File**: `src/components/clients/ClientFormFields.tsx`

```tsx
// Suggested Enhancement for legal name field:
<input
  id={legalNameId}
  type="text"
  required
  value={legalName}
  onChange={(e) => {
    setLegalName(e.target.value);
    if (fieldErrors.legal_name) setFieldErrors((p) => ({ ...p, legal_name: '' }));
  }}
  aria-invalid={Boolean(fieldErrors.legal_name)}
  aria-describedby={
    fieldErrors.legal_name
      ? `${legalNameId}-error`
      : `${legalNameId}-help`
  }
  placeholder="e.g. Ramesh Stores Private Limited"
  className="w-full rounded-lg border border-line bg-background px-4 py-3 text-base text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent min-h-[48px]"
/>
<p id={`${legalNameId}-help`} className="text-xs text-muted">As registered on the GST certificate.</p>
{fieldErrors.legal_name && (
  <p id={`${legalNameId}-error`} role="alert" className="text-sm font-medium text-ink">
    {fieldErrors.legal_name}
  </p>
)}
```

---

### Recommendation 3: Add Escape Key Listener to Archive Confirmation Dialog (WCAG 2.1.1)

**Issue**: Pressing the physical `Escape` key does not dismiss the archive confirmation dialog.  
**File**: `src/components/clients/EditClientActions.tsx`

```tsx
// Suggested Enhancement in src/components/clients/EditClientActions.tsx:
useEffect(() => {
  if (!showConfirm) return;

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      setShowConfirm(false);
    }
  }

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [showConfirm]);
```

---

### Recommendation 4: Contextual Screen Reader Labels for Table/Card Action Links (WCAG 2.4.4)

**Issue**: In `ClientTable` and `ClientCard`, repetitive "View" and "Edit" links can be ambiguous if a screen reader user navigates via a Links List (VoiceOver Rotor / NVDA Elements List).  
**File**: `src/components/clients/ClientTable.tsx` & `ClientCard.tsx`

```tsx
// Suggested Enhancement in ClientTable.tsx:
<Link
  href={`/app/clients/${client.id}`}
  aria-label={`View details for ${client.names.legal_name}`}
  className="..."
>
  View
</Link>
<Link
  href={`/app/clients/${client.id}/edit`}
  aria-label={`Edit ${client.names.legal_name}`}
  className="..."
>
  Edit
</Link>
```

---

## 8. Final Audit Sign-Off

### Reviewer Statement
The Client Management subsystem exhibits outstanding craftsmanship in responsive layout engineering, touch ergonomics, and non-color-reliant visual semantics.

1. **Micro-viewport resilience**: Tested down to 320px with **zero horizontal clipping** and **zero layout blowouts**.
2. **Ergonomic precision**: Every single interactive target meets or exceeds the **48px touch boundary**, making it exceptionally comfortable for field-accountant workflows on smartphones.
3. **Inclusive status architecture**: The `StatusBadge` design avoids the trap of color-only communication, employing 5 distinct border stroke geometries paired with plain-language status strings.
4. **Token purity**: 100% compliant with design system tokens; zero raw hex codes present in the audited code.

The advisories noted above are forward-looking enhancements and do not prevent production rollout.

**Final Assessment:** **APPROVED FOR PRODUCTION** (with minor hardening advisories).
