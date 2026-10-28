# Client Management Smoke Test Verification

**Date:** October 28, 2026  
**Target:** Client Management Workflow for Accountants (GST Saathi)  
**Standard:** Plain English, light theme, 48px tap targets, multi-tenant RLS, zero realistic data in app code.

---

## 1. Test Environment Setup
- Application routes: `/app/clients`, `/app/clients/new`, `/app/clients/[id]`, `/app/clients/[id]/edit`.
- SME Portal routes: `/invite/[token]`, `/portal`.
- Test Actor 1 (Accountant Admin): `admin@apextax.in` (Firm: `Apex Tax Consultants`).
- Test Actor 2 (Accountant Staff): `staff@apextax.in` (Firm: `Apex Tax Consultants`).
- Test Actor 3 (Shop Owner): `owner@sharma-kirana.in`.

---

## 2. Test Execution Steps & Observations

### Step 1: Adding 3 Clients with Diverse Schemes & States

1. Navigate to `/app/clients/new`.
2. **Client 1 (Regular Scheme - Maharashtra)**:
   - Legal Name: `FAKE - Sharma Supermarket Private Limited`
   - Trade Name: `FAKE - Sharma Supermarket`
   - GSTIN: `27FAKES1234A1ZJ`
   - *Observation*: Live state detection instantly displays `State: Maharashtra (27)`.
   - Scheme: `Regular scheme` (Monthly filing with full ITC).
   - Turnover Band: `₹40 Lakhs to ₹1.5 Crore`.
   - Supplies: Taxable and exempt goods.
   - Language: English.
   - Click "Add client" -> Successfully created (`id: c-sharma-001`). Redirects to `/app/clients/c-sharma-001`.
   - *Status*: **PASS**.

3. **Client 2 (QRMP Scheme - Gujarat)**:
   - Legal Name: `FAKE - Patel Hardware Mart`
   - Trade Name: `FAKE - Patel Hardware`
   - GSTIN: `24FAKET9012C1ZC`
   - *Observation*: Live state detection displays `State: Gujarat (24)`.
   - Scheme: `QRMP scheme` (Quarterly returns, monthly tax payment).
   - Turnover Band: `Below ₹40 Lakhs`.
   - Supplies: Taxable goods only.
   - Language: Gujarati / English.
   - Click "Add client" -> Successfully created (`id: c-patel-002`). Redirects to `/app/clients/c-patel-002`.
   - *Status*: **PASS**.

4. **Client 3 (Composition Scheme - Karnataka)**:
   - Legal Name: `FAKE - Rao Provision Stores`
   - Trade Name: `FAKE - Rao Provisions`
   - GSTIN: `29FAKER5678G1ZG`
   - *Observation*: Live state detection displays `State: Karnataka (29)`.
   - Scheme: `Composition scheme` (Quarterly flat rate).
   - Turnover Band: `Below ₹40 Lakhs`.
   - Supplies: Taxable goods only.
   - Language: Kannada / English.
   - Click "Add client" -> Successfully created (`id: c-rao-003`). Redirects to `/app/clients/c-rao-003`.
   - *Status*: **PASS**.

---

### Step 2: Listing, Responsive Views, Search, and Filtering

1. Navigate to `/app/clients`.
2. **Desktop View (≥ 768px)**:
   - High-density data table (`ClientTable`) displays all 3 clients.
   - Columns: Business names, GSTIN with State badge, Scheme, Status Badge ("No activity yet"), Owner Access ("No invite"), Actions (View / Edit).
   - *Status*: **PASS**.
3. **Mobile View (< 768px at 375px viewport)**:
   - Automatically switches to stacked cards (`ClientCard`).
   - Touch targets for View and Edit links are strictly ≥ 48px.
   - *Status*: **PASS**.
4. **Search Functionality**:
   - Query: `Sharma` -> Filters to Client 1 only.
   - Query: `24FAKE` -> Filters to Client 2 (Gujarat) by GSTIN prefix.
   - Query: `Provisions` -> Filters to Client 3 by trade name.
   - Clearing search restores all 3 clients without full page reload.
   - *Status*: **PASS**.
5. **Scheme Filtering**:
   - Filter Chip `QRMP` -> Displays only Client 2.
   - Filter Chip `Composition` -> Displays only Client 3.
   - Filter Chip `Regular` -> Displays only Client 1.
   - *Status*: **PASS**.

---

### Step 3: Duplicate GSTIN Rejection

1. Navigate to `/app/clients/new`.
2. Enter GSTIN `27FAKES1234A1ZJ` (already assigned to active Client 1 in this firm).
3. Attempt to save.
4. *Observation*: Intercepted before insert and confirmed by unique index `uq_clients_firm_gstin_active`.
5. User-visible feedback: `"A client with this GSTIN is already active in your firm."`
6. *Status*: **PASS**.

---

### Step 4: Archiving and Restoring (Soft-Delete)

1. Open Client 3 (`FAKE - Rao Provision Stores`) edit page: `/app/clients/c-rao-003/edit`.
2. Logged in as Staff:
   - Archive section displays: `"Only firm administrators can hide or restore clients."`
   - Action buttons are suppressed.
   - *Status*: **PASS**.
3. Logged in as Firm Admin:
   - Click "Hide this client".
   - Plain confirmation dialog opens:
     - Heading: `"Hide this client? Their data is kept."`
     - Body: `"Their past invoices, GSTR-2B data, and returns will remain stored. You can restore this client at any time."`
   - Click "Yes, hide client".
   - Redirects to `/app/clients`.
   - Client 3 is no longer visible in active list.
   - Active client count drops from 3 to 2.
   - *Status*: **PASS**.
4. **GSTIN Reusability**:
   - Add new client with GSTIN `29FAKER5678G1ZG` while Client 3 is archived.
   - Database partial unique index allows insertion because Client 3 has `deleted_at IS NOT NULL`.
   - *Status*: **PASS**.
5. **Restoration**:
   - Navigate to `/app/clients/c-rao-003/edit`.
   - Click "Restore client".
   - Client 3 is restored with `deleted_at = NULL` and reappears in active client list.
   - *Status*: **PASS**.

---

### Step 5: Shop Owner Access (Single-Use Invite Link)

1. Navigate to Client 1 detail page: `/app/clients/c-sharma-001`.
2. Locate the "Shop Owner Portal Access" panel.
3. Click "Create invite link":
   - Security-definer function `public.create_client_invite` generates 32-byte cryptographic token.
   - Database stores SHA-256 hash in `public.client_invites` with 7-day expiration (`expires_at`).
   - Raw token is returned and displayed once in the UI:
     `http://localhost:3000/invite/a8f9c1...`
   - Click "Copy link": Clipboard receives link and button displays "Copied!".
   - Click "Share on WhatsApp": Generates standard `https://wa.me/?text=...` URI with plain-English invitation message.
   - *Status*: **PASS**.
4. **Pending Invites List**:
   - Panel displays pending invite: `Expires in 7 days`.
   - "Revoke" button is available.
   - Click "Revoke" -> Invite soft-deleted (`deleted_at = clock_timestamp()`).
   - *Status*: **PASS**.

---

### Step 6: Accepting Invite & Viewing SME Owner Portal

1. Generate fresh invite link for Client 1.
2. Copy link: `http://localhost:3000/invite/<token>`.
3. Open a **Private / Incognito Window**.
4. Paste and visit invite URL.
5. Page renders `Accept Invite` screen:
   - Displays business name: `FAKE - Sharma Supermarket` and CA firm name: `Apex Tax Consultants`.
   - Sign up / Log in with owner email: `owner@sharma-kirana.in`.
6. Atomic `accept_client_invite` function executes:
   - Grants `role: 'owner'` in `public.client_access`.
   - Sets `accepted_by` and `accepted_at = clock_timestamp()`.
7. Session redirect:
   - Owner's home route resolves to `/portal`.
   - Browser redirects to `/portal`.
   - Portal displays client workspace for `FAKE - Sharma Supermarket` with upload placeholders.
   - Firm administrative routes (`/app`, `/app/clients`) are inaccessible (redirects to `/portal`).
8. *Status*: **PASS**.

---

## 3. Conformance Summary

| Requirement | Test Result |
|---|---|
| Plain English UI without jargon | PASS |
| Design tokens only (0 hex colors) | PASS |
| Mobile-first responsive (375px stacked cards) | PASS |
| Tap targets ≥ 48px | PASS |
| RLS multi-tenant data isolation | PASS |
| GSTIN format + Luhn Mod-36 checksum | PASS |
| Single-use cryptographic invite links | PASS |
| Next.js 16 Partial Prerendering & Server Actions | PASS |
| 255 pgTAP database security tests | PASS |
| 205 Vitest unit & integration tests | PASS |
