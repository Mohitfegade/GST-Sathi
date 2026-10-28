# QA Audit Report: Accountant Workflow & Usability (R1)

**Date:** October 28, 2026  
**Auditor:** Reviewer R1 (Accountant Workflow & UX Specialist)  
**Target:** Client Management Workflow (`/app/clients`, `/app/clients/new`, `/app/clients/[id]`, `/app/clients/[id]/edit`)  
**Standard:** Plain English, rapid keyboard workflow, high data-entry throughput.

---

## 1. Executive Summary

| Dimension | Evaluation Criteria | Verdict | Notes |
|---|---|---|---|
| **High-Throughput Onboarding** | Adding multiple clients consecutively without modal fatigue | **PASS** | Clean linear form, sensible defaults (`Regular scheme`, `Below ₹40 Lakhs`, `Taxable goods: true`). |
| **GSTIN Paste & Typing Behaviour** | Auto-uppercasing, trimming, special-char filtering | **PASS** | Sanitizes pastes (removes whitespace/hyphens), autodetects state in real-time. |
| **Keyboard Navigation & Flow** | Logical tab order, form submit via Enter key | **PASS** | Top-to-bottom tab order without keyboard traps. |
| **Duplicate GSTIN Handling** | Friendly, non-blocking error messaging | **PASS** | Intercepts duplicates gracefully without clearing entered form data. |
| **Plain-Language Copy** | Zero tax jargon, short sentences, friendly tone | **PASS** | Simple explanations for schemes, turnover bands, and archive confirmation. |

---

## 2. In-Depth Evaluation

### 2.1 Time to Add 20 Clients (Accountant Efficiency)
- Form layout is structured in 3 clear groupings: Business details, Tax scheme & turnover, What the shop sells.
- Defaults preselect the most common SME configuration in India:
  - Scheme: `Regular scheme`
  - Turnover: `Below ₹40 Lakhs`
  - Supplies: `Taxable goods: true`, `Exempt goods: false`
  - Language: `English`
- An accountant typing standard client data can complete an entry in ~20 seconds using keyboard tabs and Enter.

### 2.2 GSTIN Input Behavior
- Input enforces 15-character uppercase formatting: `val.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 15)`.
- Pasting with spaces (e.g. `27 ABCDE 1234 F 1 Z 5`) is automatically normalized.
- Real-time state detection displays the state name (e.g. `State: Maharashtra (27)`) as soon as the first two digits are typed, giving immediate visual confirmation before submitting.
- Modulo-36 check character validation warns of transposition typos before submission.

### 2.3 Duplicate Handling
- If an accountant mistakenly enters a GSTIN that already belongs to an active client in the firm, the server action returns:
  `"A client with this GSTIN is already active in your firm."`
- The form highlights the GSTIN field without clearing the legal name, trade name, or other options entered.

### 2.4 Confirmation Copy for Archiving
- Dialog avoids alarming technical language ("delete", "cascade", "drop").
- Uses plain-language phrasing:
  - Heading: `"Hide this client? Their data is kept."`
  - Body: `"Their past invoices, GSTR-2B data, and returns will remain stored. You can restore this client at any time."`

---

## 3. Recommendations & Enhancements
1. **Post-Creation Shortcut**: Add a secondary button on the Add Client page: `"Save and add another"` to allow rapid batch entry without returning to the list.
2. **GSTIN Search Shortcuts**: Ensure search bar autofocuses on pressing `/` shortcut key for high-volume firms.

**Overall Verdict:** **APPROVED FOR PRODUCTION**.
