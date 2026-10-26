# Accessibility QA Review Report: Landing Page Entry Points

**Project:** GST Saathi Web Application  
**Audit Date:** October 26, 2026  
**Auditor:** Reviewer R2 (Accessibility Specialist)  
**Conformance Standard:** WCAG 2.2 Level AA (with Level AAA comparisons where applicable)  
**Evaluated Target:** Landing page entry points ("Log in", "Create account" / "Sign up" in Header and Footer, Skip Link, and supporting layout components)  
**Files Inspected:**
- `src/components/layout/Header.tsx`
- `src/components/layout/Footer.tsx`
- `src/components/ui/Button.tsx`
- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/config/site.ts`
- `src/app/globals.css` (Design tokens & global focus indicators)

**Overall Status:** **PASS WITH ADVISORIES**  
*Zero Critical (Level A/AA) blocking violations. All contrast ratios exceed WCAG AA/AAA thresholds. All interactive links provide discernible accessible names. Full sequential keyboard navigation is operational. Several minor advisories and hardening opportunities are documented with exact remediation code.*

---

## 1. Executive Summary

This accessibility evaluation examined the newly added landing page entry points ("Log in" and "Create account") across desktop and mobile viewports. The audit focused on screen reader accessible name computation, responsive label switching, sequential keyboard focus order, focus visibility under WCAG 2.2 SC 2.4.11 (Focus Appearance), skip navigation, color contrast ratios under WCAG 2.2 SC 1.4.3 / SC 1.4.11, and landmark semantics.

### Summary Scorecard

| Evaluation Dimension | WCAG 2.2 Criteria | Rating | Summary |
|---|---|---|---|
| **1. Accessible Link Names** | SC 2.4.4 (Link Purpose), SC 2.5.3 (Label in Name), SC 4.1.2 (Name, Role, Value) | **PASS** | Clear, unambiguous names on all links ("Log in", "Create account", "GST Saathi"). Responsive label switching ("Create account" $\leftrightarrow$ "Sign up") complies with SC 2.5.3. |
| **2. Focus Order & Focus Indicators** | SC 2.1.1 (Keyboard), SC 2.4.3 (Focus Order), SC 2.4.7 (Focus Visible), SC 2.4.11 (Focus Appearance) | **PASS (Advisory)** | Tab sequence is strictly logical from top to bottom. Global `*:focus-visible` ensures 2px accent outline (`6.70:1` contrast). Footer links lack custom rounded ring styling. |
| **3. Skip Navigation Link** | SC 2.4.1 (Bypass Blocks) | **PASS (Advisory)** | Accessible skip link exists in `src/app/page.tsx`, focuses visibly with `6.70:1` contrast, and jumps to `<main id="main-content" tabIndex={-1}>`. Recommending hoisting to `layout.tsx`. |
| **4. Color Contrast & Tokens** | SC 1.4.3 (Contrast Minimum), SC 1.4.11 (Non-text Contrast) | **PASS (Exceeds AA/AAA)** | Primary text (`--ink`) achieves **19.67:1** (AAA). Secondary text (`--muted`) achieves **7.39:1** (AAA). Button text (`--on-accent` on `--accent`) achieves **6.70:1** (AA/AAA Large). |
| **5. Semantic HTML & Landmarks** | SC 1.3.1 (Info and Relationships) | **PASS (Advisory)** | Semantic `<header>`, `<nav>`, `<main>`, and `<footer>` elements used correctly. Dual `<nav>` landmarks are distinguished with `aria-label`. |
| **6. Target Size (WCAG 2.2)** | SC 2.5.8 (Target Size - Minimum) | **PASS** | Auth links and buttons enforce `min-h-[48px]`, comfortably surpassing the 24×24px AA threshold and meeting the 48px touch ergonomic standard. |

---

## 2. Checklist Item Evaluations

### 2.1 Accessible Link Names & Responsive Labeling

#### A. Inspected Elements & Accessible Name Computation

| Element | Location | Code Pattern | Computed Accessible Name | Conformance Result |
|---|---|---|---|---|
| **Logo Link** | `Header.tsx:17-22` | `<Link href="/">{siteConfig.name}</Link>` | `"GST Saathi"` | **PASS** (Clear, brand-identified home link) |
| **Nav Links** | `Header.tsx:26-33` | `<Link href={link.href}>{link.label}</Link>` | `"How it works"`, `"For accountants"` | **PASS** (Directly matches link label) |
| **Header "Log in"** | `Header.tsx:38-43` | `<Link href="/login">Log in</Link>` | `"Log in"` | **PASS** (Concise, unambiguous action name) |
| **Header CTA Button** | `Header.tsx:44-51` | `<Button href="/signup"><span className="hidden sm:inline">Create account</span><span className="sm:hidden">Sign up</span></Button>` | Desktop: `"Create account"`<br>Mobile: `"Sign up"` | **PASS** (Matches visible text on all viewports) |
| **Footer Nav Links** | `Footer.tsx:27-34` | `<Link href={link.href}>{link.label}</Link>` | `"How it works"`, `"For accountants"` | **PASS** (Identical to header nav items) |
| **Footer "Log in"** | `Footer.tsx:39-44` | `<Link href="/login">Log in</Link>` | `"Log in"` | **PASS** (Clear authentication link) |
| **Footer "Create account"** | `Footer.tsx:45-50` | `<Link href="/signup">Create account</Link>` | `"Create account"` | **PASS** (Consistent with desktop header CTA) |
| **Footer Email** | `Footer.tsx:51-56` | `<a href="mailto:hello@example.com">{siteConfig.contactEmail}</a>` | `"hello@example.com"` | **PASS** (Discernible mailto link with underline) |

#### B. Deep-Dive: Responsive Text Hiding (`hidden sm:inline` vs `sm:hidden`)

The header's registration button handles constrained mobile viewports by displaying "Sign up" below `640px` and "Create account" at or above `640px`:

```tsx
<Button
  href={siteConfig.authLinks?.signup ?? "/signup"}
  variant="primary"
  className="whitespace-nowrap max-sm:px-3 max-sm:text-[14px]"
>
  <span className="hidden sm:inline">Create account</span>
  <span className="sm:hidden">Sign up</span>
</Button>
```

1. **Accessibility Tree Exclusion (HTML-AAM 1.0 & W3C ARIA):**
   - Tailwind's `.hidden` sets `display: none;`.
   - On mobile viewports (`< 640px`), `.hidden` applies to the first `<span>`. Under W3C accessibility tree mapping rules, elements with `display: none` are completely removed from the accessibility tree.
   - On desktop viewports (`≥ 640px`), `.sm:hidden` applies `display: none` to the second `<span>`.
   - **Result:** Assistive technologies (JAWS, NVDA, VoiceOver, TalkBack) parse **only the visible span**. Screen readers never announce both labels concatenated together (e.g. they do not announce *"Create account Sign up"*).

2. **WCAG 2.2 SC 2.5.3 (Label in Name - Level A) Compliance:**
   - SC 2.5.3 requires: *"For user interface components with labels that include text or images of text, the name contains the text that is presented visually."*
   - Because no overriding `aria-label` is applied, the accessible name is derived directly from the visible text node.
   - For speech-input users (e.g. Dragon NaturallySpeaking, Apple Voice Control):
     - On desktop: Visible label is "Create account"; accessible name is "Create account". The command *"Click Create account"* succeeds.
     - On mobile: Visible label is "Sign up"; accessible name is "Sign up". The command *"Click Sign up"* succeeds.
   - **Critical Note:** Had the author hardcoded `aria-label="Create account"` onto `<Button>`, speech-input users on mobile would say *"Click Sign up"* and the command would fail, triggering a Level A violation. The present DOM implementation is compliant with SC 2.5.3.

3. **Advisory / Edge Case:**
   - If CSS fails to load or in pure text-only user agents that strip media queries, both spans will render inline as *"Create accountSign up"*. While this is an accepted edge-case limitation of responsive CSS techniques, keeping the label identical across all breakpoints (e.g. "Create account" with responsive padding) is an optional defensive design pattern.

---

### 2.2 Focus Order & Focus Indicators

#### A. Keyboard Navigation Sequence Trace

When navigating sequentially via `Tab` from document top:

```text
1. [Skip Link]          "Skip to main content" (Fixed overlay in top-left, bg-accent, text-on-accent)
   └── (If Enter pressed -> Focus jumps directly to <main id="main-content" tabIndex={-1}>)
2. [Header Logo Link]   "GST Saathi" (href="/")
3. [Header Nav 1]       "How it works" (href="#how-it-works", hidden on mobile < 768px)
4. [Header Nav 2]       "For accountants" (href="#for-accountants", hidden on mobile < 768px)
5. [Header Link]        "Log in" (href="/login")
6. [Header Button]      "Create account" / "Sign up" (href="/signup")
7. [Main Landmark]      Interactive sections within <main> (Hero buttons, How it works, Final CTA)
8. [Footer Nav 1]       "How it works" (href="#how-it-works")
9. [Footer Nav 2]       "For accountants" (href="#for-accountants")
10. [Footer Link]       "Log in" (href="/login")
11. [Footer Link]       "Create account" (href="/signup")
12. [Footer Link]       "hello@example.com" (href="mailto:...")
```

- **Natural Flow:** The tab sequence strictly matches the DOM order and visual reading order (top $\rightarrow$ bottom, left $\rightarrow$ right).
- **Tabindex Hygiene:** Zero elements declare positive `tabIndex` values. The only manual tabindex is `tabIndex={-1}` on `<main>`, correctly permitting script/anchor programmatic focus redirection.

#### B. Focus Indicator Conformance (WCAG 2.2 SC 2.4.7 & SC 2.4.11)

1. **Global Base Rule (`src/app/globals.css:36-39`):**
   ```css
   *:focus-visible {
     outline: 2px solid var(--color-accent, var(--accent));
     outline-offset: 2px;
   }
   ```
   - Color: `--accent` (`#1D4ED8`).
   - Contrast against canvas (`#FFFFFF`): **6.70:1** (Exceeds SC 1.4.11 / 2.4.11 minimum threshold of 3:1).
   - Outline width: `2px` with `2px` offset, creating a clearly visible boundary indicator.

2. **Per-Component Focus Styling Analysis:**
   - **Skip Link (`page.tsx:15`):** `focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent`. High visual prominence.
   - **Header "Log in" (`Header.tsx:40`):** `rounded-[8px] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent`. Custom 2px blue ring conforming to component border radius.
   - **Header "Create account" (`Button.tsx:26`):** `rounded-[8px] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2`. Double-boundary indicator with 2px white offset and 2px accent ring.
   - **Header Logo (`Header.tsx:19`):** Lacks explicit Tailwind focus utility classes. Inherits global `*:focus-visible` (2px outline). Fully compliant, but renders as a square outline rather than matching the 8px rounded corners used elsewhere.
   - **Footer Links (`Footer.tsx:41, 47, 53`):** Lack explicit Tailwind focus utility classes. Inherit global `*:focus-visible` (2px outline). Fully compliant with SC 2.4.7/2.4.11, but lack rounded contouring.

---

### 2.3 Skip Navigation Link Architecture

#### A. Conformance Evaluation (WCAG 2.2 SC 2.4.1 Bypass Blocks - Level A)

The skip navigation implementation is defined in `src/app/page.tsx:13-20`:

```tsx
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-accent focus:text-on-accent focus:rounded-[8px] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent font-medium text-sm"
>
  Skip to main content
</a>
<Header />
<main id="main-content" tabIndex={-1} className="focus:outline-none">
```

1. **Visibility on Focus:** Off-screen by default via `sr-only`. When focused, `focus:not-sr-only` and `focus:fixed focus:top-4 focus:left-4 focus:z-50` position the link in the upper-left viewport above the sticky header.
2. **Color Contrast:**
   - Foreground (`focus:text-on-accent` = `#FFFFFF`) on Background (`focus:bg-accent` = `#1D4ED8`): **6.70:1** (Passes WCAG AA 4.5:1).
   - Ring (`focus:ring-accent` = `#1D4ED8`) on white backdrop: **6.70:1** (Passes WCAG non-text 3:1).
3. **Target Anchor & Programmatic Focus:**
   - Target is `<main id="main-content" tabIndex={-1}>`.
   - `tabIndex={-1}` ensures that activating the skip link moves browser keyboard focus directly to `<main>` in all rendering engines (including WebKit/Safari, which otherwise fail to shift tab stop upon hash anchor clicks).
   - `className="focus:outline-none"` suppresses an unsightly full-viewport outline on the entire `<main>` container while preserving focus transfer.
4. **Architectural Scope (Advisory):**
   - The skip link is currently embedded inside `src/app/page.tsx`.
   - Secondary routes (`/privacy`, `/terms`, `/login`, `/signup`) will not render this skip link unless it is migrated into `src/app/layout.tsx`.

---

### 2.4 Color Contrast & Design Token Analysis

#### A. W3C Relative Luminance & Contrast Formula
$$\text{Relative Luminance } L = 0.2126 \times R + 0.7152 \times G + 0.0722 \times B$$
$$\text{Contrast Ratio} = \frac{\max(L_1, L_2) + 0.05}{\min(L_1, L_2) + 0.05}$$

#### B. Palette Tokens & Measured Luminance
- `--background`: `#FFFFFF` ($L = 1.0000$)
- `--surface`: `#F6F6F4` ($L = 0.9185$)
- `--ink`: `#0B0B0C` ($L = 0.0034$)
- `--muted`: `#55555C` ($L = 0.0920$)
- `--line`: `#E3E3E0` ($L = 0.7735$)
- `--accent`: `#1D4ED8` ($L = 0.1069$)
- `--accent-hover`: `#1E40AF` ($L = 0.0705$)
- `--on-accent`: `#FFFFFF` ($L = 1.0000$)

#### C. Comprehensive Pairwise Contrast Table

| UI Component / Link | Foreground Token (Hex) | Background Token (Hex) | Calculated Ratio | WCAG 2.2 AA Normal (Min 4.5:1) | WCAG 2.2 AA Large / UI (Min 3:1) | WCAG 2.2 AAA Normal (Min 7:1) | Result |
|---|---|---|---|---|---|---|---|
| **Header Logo Link** | `--ink` (`#0B0B0C`) | `--background` (`#FFFFFF`) | **19.67:1** | Pass | Pass | Pass | **PASS (AAA)** |
| **Header Nav Links (Default)** | `--muted` (`#55555C`) | `--background` (`#FFFFFF`) | **7.39:1** | Pass | Pass | Pass | **PASS (AAA)** |
| **Header Nav Links (Hover)** | `--ink` (`#0B0B0C`) | `--background` (`#FFFFFF`) | **19.67:1** | Pass | Pass | Pass | **PASS (AAA)** |
| **Header "Log in" Link** | `--muted` (`#55555C`) | `--background` (`#FFFFFF`) | **7.39:1** | Pass | Pass | Pass | **PASS (AAA)** |
| **Header "Log in" (Hover)** | `--ink` (`#0B0B0C`) | `--background` (`#FFFFFF`) | **19.67:1** | Pass | Pass | Pass | **PASS (AAA)** |
| **Header "Create account" Button** | `--on-accent` (`#FFFFFF`) | `--accent` (`#1D4ED8`) | **6.70:1** | Pass | Pass | Pass (Large) | **PASS (AA)** |
| **Header Button (Hover State)** | `--on-accent` (`#FFFFFF`) | `--accent-hover` (`#1E40AF`) | **8.72:1** | Pass | Pass | Pass | **PASS (AAA)** |
| **Header Focus Indicator Ring** | `--accent` (`#1D4ED8`) | `--background` (`#FFFFFF`) | **6.70:1** | N/A | Pass (SC 1.4.11) | N/A | **PASS** |
| **Footer Site Title** | `--ink` (`#0B0B0C`) | `--background` (`#FFFFFF`) | **19.67:1** | Pass | Pass | Pass | **PASS (AAA)** |
| **Footer Body / Disclaimer** | `--muted` (`#55555C`) | `--background` (`#FFFFFF`) | **7.39:1** | Pass | Pass | Pass | **PASS (AAA)** |
| **Footer Nav Links** | `--muted` (`#55555C`) | `--background` (`#FFFFFF`) | **7.39:1** | Pass | Pass | Pass | **PASS (AAA)** |
| **Footer "Log in" Link** | `--muted` (`#55555C`) | `--background` (`#FFFFFF`) | **7.39:1** | Pass | Pass | Pass | **PASS (AAA)** |
| **Footer "Create account" Link** | `--muted` (`#55555C`) | `--background` (`#FFFFFF`) | **7.39:1** | Pass | Pass | Pass | **PASS (AAA)** |
| **Footer Email Link** | `--muted` (`#55555C`) | `--background` (`#FFFFFF`) | **7.39:1** | Pass | Pass | Pass | **PASS (AAA)** |
| **Footer Copyright Text** | `--muted` (`#55555C`) | `--background` (`#FFFFFF`) | **7.39:1** | Pass | Pass | Pass | **PASS (AAA)** |
| **Skip Link (Focused State)** | `--on-accent` (`#FFFFFF`) | `--accent` (`#1D4ED8`) | **6.70:1** | Pass | Pass | Pass (Large) | **PASS (AA)** |

#### D. Design System Rules Compliance Check
- **Zero Hardcoded Hex Codes:** Verified. All components in the header, footer, skip link, button, and layout utilize Tailwind classes referencing CSS custom properties (`bg-background`, `border-line`, `text-ink`, `text-muted`, `bg-accent`, `text-on-accent`, `focus-visible:ring-accent`).
- **Light Theme Enforced:** No dark-mode overrides or pastel ambiguities exist.

---

### 2.5 Semantic HTML & Landmarks

#### A. Landmark Structure Overview

```text
├── <header> (role="banner", Header.tsx:13)
│   ├── <a href="/"> (Site logo link)
│   ├── <nav aria-label="Main Navigation"> (Header.tsx:24)
│   │   ├── <a href="#how-it-works">
│   │   └── <a href="#for-accountants">
│   └── <div> (Auth actions container)
│       ├── <a href="/login"> ("Log in")
│       └── <a href="/signup"> ("Create account" / "Sign up")
│
├── <main id="main-content" tabIndex={-1}> (role="main", page.tsx:20)
│   ├── <section aria-labelledby="hero-heading"> (Hero)
│   ├── <section aria-labelledby="problem-heading"> (Problem)
│   ├── <section aria-labelledby="how-it-works-heading"> (How it works)
│   ├── <section aria-labelledby="checks-heading"> (What it checks)
│   ├── <section aria-labelledby="audience-heading"> (Audience)
│   └── <section aria-labelledby="final-cta-heading"> (Final CTA)
│
└── <footer> (role="contentinfo", Footer.tsx:10)
    ├── <nav aria-label="Footer Navigation"> (Footer.tsx:25)
    │   ├── <a href="#how-it-works">
    │   └── <a href="#for-accountants">
    └── <div> (Footer auth & contact container)
        ├── <a href="/login"> ("Log in")
        ├── <a href="/signup"> ("Create account")
        └── <a href="mailto:..."> ("hello@example.com")
```

#### B. Landmark Findings & Advisories

1. **Multiple `<nav>` Landmark Differentiation (WCAG 1.3.1):**
   - The page contains two `<nav>` elements: one in `<header>` and one in `<footer>`.
   - Each carries a distinct `aria-label`: `aria-label="Main Navigation"` and `aria-label="Footer Navigation"`.
   - **Compliance:** Satisfies WCAG 1.3.1. Assistive technology rotor / landmark menus present both navigation regions distinctly.
   - **WAI-ARIA Best Practice:** Screen readers automatically append the word "navigation" when voicing `<nav>` landmarks. Hence, `aria-label="Main Navigation"` is voiced as *"Main Navigation, navigation region"*. Shortening labels to `aria-label="Main"` (or `"Primary"`) and `aria-label="Footer"` eliminates redundancy.
2. **Placement of Auth Entry Points:**
   - In `<header>`, the "Log in" link and "Create account" button reside in a flex `<div>` directly within `<header>`, outside the primary `<nav>`. This correctly separates global utility actions from in-page section links.
   - In `<footer>`, the auth and email links reside in a companion flex `<div>` within `<footer>`. This is semantically sound and preserves landmark clarity.

---

### 2.6 Target Size & Touch Ergonomics (WCAG 2.2 SC 2.5.8)

WCAG 2.2 Level AA introduced Success Criterion 2.5.8 (Target Size - Minimum), requiring targets to measure at least 24×24 CSS pixels unless an inline or spacing exception applies.

- **Header "Log in":** Enforces `min-h-[48px] px-2 sm:px-3` $\rightarrow$ Target height is 48px, width is $\approx 58\text{px}$–$66\text{px}$. Exceeds 24×24px AA and matches the 48px standard.
- **Header "Create account" / "Sign up":** Enforces `min-h-[48px] px-3 sm:px-6` $\rightarrow$ Target height is 48px, width is $\approx 80\text{px}$–$140\text{px}$.
- **Footer Links ("Log in", "Create account", Email):** Enforce `inline-flex min-h-[48px] items-center px-2 py-2` $\rightarrow$ Target height is 48px.
- **Header & Footer Nav Links:** Inline links with no vertical padding. However, they are separated by `gap-6` (24px) in the flex container, fully qualifying for the 24px spacing exception under SC 2.5.8.

---

## 3. Findings, Advisories & Remediation Plan

### Severity Classification Matrix

- **Critical:** Disables access for disabled users; direct WCAG 2.2 Level A/AA failure.
- **Major:** Significant accessibility barrier degrading assistive technology experience.
- **Minor / Advisory:** Sub-optimal pattern, aesthetic focus discrepancy, or future scalability improvement.

| Issue ID | Severity | Criterion | Component | Description | Remediation Summary |
|---|---|---|---|---|---|
| **ADV-A11Y-01** | Minor / Advisory | SC 2.4.7 / 2.4.11 | `Footer.tsx` | Footer auth and nav links rely on generic global `*:focus-visible` rectangular outline rather than rounded design token ring. | Add `rounded-[6px] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent` to footer links. |
| **ADV-A11Y-02** | Minor / Advisory | SC 2.4.7 / 2.4.11 | `Header.tsx` | Header Logo link lacks explicit focus ring class, displaying a rectangular outline on focus. | Add `rounded-[8px] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent` to logo link. |
| **ADV-A11Y-03** | Advisory | SC 1.3.1 | `Header.tsx`, `Footer.tsx` | Redundant landmark announcement ("Main Navigation, navigation"). | Change `aria-label="Main Navigation"` to `aria-label="Main"`, and `"Footer Navigation"` to `"Footer"`. |
| **ADV-A11Y-04** | Architecture Advisory | SC 2.4.1 | `src/app/page.tsx`, `src/app/layout.tsx` | Skip link resides only in `page.tsx` rather than root `layout.tsx`. | Hoist `<a href="#main-content">` to `layout.tsx` so all app routes provide bypass navigation. |
| **ADV-A11Y-05** | Usability Advisory | SC 2.5.8 | `Header.tsx` | Desktop nav links have no vertical padding. | Add `py-2` to header desktop nav links for larger click/touch area on hybrid laptops. |

---

## 4. Concrete Remediation Guidance (Before vs After)

### Remediation 1: Unified Focus Styling on Footer Links (`src/components/layout/Footer.tsx`)

#### Before (`src/components/layout/Footer.tsx:38-57`):
```tsx
<div className="flex flex-wrap items-center gap-x-2 gap-y-1 md:justify-end">
  <Link
    href={siteConfig.authLinks?.login ?? "/login"}
    className="inline-flex min-h-[48px] items-center px-2 py-2 text-muted transition-colors hover:text-ink"
  >
    Log in
  </Link>
  <Link
    href={siteConfig.authLinks?.signup ?? "/signup"}
    className="inline-flex min-h-[48px] items-center px-2 py-2 text-muted transition-colors hover:text-ink"
  >
    Create account
  </Link>
  <a
    href={`mailto:${siteConfig.contactEmail}`}
    className="inline-flex min-h-[48px] items-center px-2 py-2 text-muted underline underline-offset-4 transition-colors hover:text-ink"
  >
    {siteConfig.contactEmail}
  </a>
</div>
```

#### After:
```tsx
<div className="flex flex-wrap items-center gap-x-2 gap-y-1 md:justify-end">
  <Link
    href={siteConfig.authLinks?.login ?? "/login"}
    className="inline-flex min-h-[48px] items-center px-2 py-2 text-muted transition-colors hover:text-ink rounded-[6px] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
  >
    Log in
  </Link>
  <Link
    href={siteConfig.authLinks?.signup ?? "/signup"}
    className="inline-flex min-h-[48px] items-center px-2 py-2 text-muted transition-colors hover:text-ink rounded-[6px] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
  >
    Create account
  </Link>
  <a
    href={`mailto:${siteConfig.contactEmail}`}
    className="inline-flex min-h-[48px] items-center px-2 py-2 text-muted underline underline-offset-4 transition-colors hover:text-ink rounded-[6px] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
  >
    {siteConfig.contactEmail}
  </a>
</div>
```

---

### Remediation 2: Focus Ring and Landmark Polishing on Header (`src/components/layout/Header.tsx`)

#### Before (`src/components/layout/Header.tsx:17-34`):
```tsx
<Link
  href="/"
  className="inline-flex items-center min-h-[48px] py-2 text-[17px] font-semibold tracking-tight text-ink hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
>
  {siteConfig.name}
</Link>

<nav aria-label="Main Navigation" className="hidden md:flex items-center gap-6 lg:gap-8">
  {siteConfig.navLinks.map((link) => (
    <Link
      key={link.href}
      href={link.href}
      className="text-[15px] font-medium text-muted hover:text-ink transition-colors"
    >
      {link.label}
    </Link>
  ))}
</nav>
```

#### After:
```tsx
<Link
  href="/"
  className="inline-flex items-center min-h-[48px] px-1 py-2 text-[17px] font-semibold tracking-tight text-ink hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 rounded-[8px] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
>
  {siteConfig.name}
</Link>

<nav aria-label="Main" className="hidden md:flex items-center gap-6 lg:gap-8">
  {siteConfig.navLinks.map((link) => (
    <Link
      key={link.href}
      href={link.href}
      className="inline-flex items-center min-h-[40px] py-2 text-[15px] font-medium text-muted hover:text-ink transition-colors rounded-[6px] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {link.label}
    </Link>
  ))}
</nav>
```

---

### Remediation 3: Global Skip Link in Root Layout (`src/app/layout.tsx`)

#### Before (`src/app/layout.tsx:22-29`):
```tsx
  return (
    <html lang="en" className={`${inter.variable} scroll-smooth`}>
      <body
        className={`${inter.className} min-h-screen flex flex-col bg-background text-ink text-[17px] leading-[1.6] antialiased`}
      >
        {children}
      </body>
    </html>
  );
```

#### After:
```tsx
  return (
    <html lang="en" className={`${inter.variable} scroll-smooth`}>
      <body
        className={`${inter.className} min-h-screen flex flex-col bg-background text-ink text-[17px] leading-[1.6] antialiased`}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-accent focus:text-on-accent focus:rounded-[8px] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent font-medium text-sm"
        >
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
```
*(With corresponding removal of the duplicate skip link in `src/app/page.tsx`)*.

---

## 5. Verification & Conformance Statement

The new landing page entry points in Header and Footer conform to the requirements of **WCAG 2.2 Level AA**:
1. **Perceivable:** Text contrast exceeds the 4.5:1 AA ratio across all interactive states (ranging from 6.70:1 to 19.67:1).
2. **Operable:** Complete sequential keyboard navigation is supported with a functional skip link, zero keyboard traps, and compliant visible focus indicators.
3. **Understandable:** Link purposes are obvious in context. The responsive label adaptation preserves exact 1:1 concordance between visible text and accessible name (SC 2.5.3).
4. **Robust:** Semantic HTML5 elements (`<header>`, `<nav>`, `<main>`, `<footer>`) are leveraged without invalid ARIA role overrides.

**Conclusion:** The implementation is **APPROVED** for production with the optional advisories queued for standard UI polish.
