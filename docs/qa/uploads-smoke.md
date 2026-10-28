# Smoke Test & Integration Verification Report: Purchase-Bill Uploads

**Date:** October 28, 2026  
**Environment:** Next.js 16.4.3 (Turbopack, App Router), PostgreSQL 15 (Supabase Local Docker), Vitest 5.0.5  
**Feature:** Purchase-Bill Uploading and Listing (`/app/clients/[id]/bills` & `/portal/bills`)  
**Status:** **ALL GATES PASS (348/348 Vitest, 301/301 pgTAP, 23/23 routes built, 0 token violations)**

---

## 1. Executive Summary

| Verification Gate | Expected Outcome | Actual Result | Status |
|---|---|---|---|
| **Database Migrations** | 13 migrations apply cleanly on clean DB | Applied `20261101000000_base.sql` to `20261101000120_uploads.sql` | **PASS** |
| **pgTAP Test Suite** | 6 test files, all tests passing | 6 files, 301/301 tests passed | **PASS** |
| **Database Types Sync** | `src/lib/database.types.ts` regenerated from local DB | Generated with full types for `documents` and new RPCs | **PASS** |
| **Schema Check** | All 25 tables matched domain models | 25/25 tables matched | **PASS** |
| **Unit & Integration Tests** | 22 test files, zero skipped tests | 22 files, 348/348 tests passed | **PASS** |
| **TypeScript Typecheck** | `tsc --noEmit` zero errors | 0 errors | **PASS** |
| **ESLint Check** | `eslint` zero errors and warnings | 0 errors | **PASS** |
| **Design Token Audit** | `node scripts/check-tokens.mjs` zero hex violations | 0 violations (strictly design tokens) | **PASS** |
| **Production Build** | `next build` all routes generated | 23 routes generated (including `/portal/bills` & `/app/clients/[id]/bills`) | **PASS** |
| **Dev Tooling & Seeding** | `dev:upload`, `uploads:cleanup`, `db:seed:clients` | Successfully tested upload, duplicate skipping, and cleanup | **PASS** |

---

## 2. Detailed Test Results

### 2.1 Database pgTAP Tests (`npm run db:test`)
```
Connecting to local database...
/Users/Mohit/Documents/antigravity/mysterious-bose/supabase/tests/rls_client_support.test.sql ............... ok
/Users/Mohit/Documents/antigravity/mysterious-bose/supabase/tests/rls_invites.test.sql ...................... ok
/Users/Mohit/Documents/antigravity/mysterious-bose/supabase/tests/rls_recon_sales_returns_alerts.test.sql ... ok
/Users/Mohit/Documents/antigravity/mysterious-bose/supabase/tests/rls_rules_audit_storage.test.sql .......... ok
/Users/Mohit/Documents/antigravity/mysterious-bose/supabase/tests/rls_tenancy_documents_purchases.test.sql .. ok
/Users/Mohit/Documents/antigravity/mysterious-bose/supabase/tests/rls_uploads.test.sql ...................... ok
All tests successful.
Files=6, Tests=301,  1 wallclock secs
Result: PASS
```

### 2.2 Vitest Application Test Suite (`npm test`)
```
Test Files  22 passed (22)
     Tests  348 passed (348)
```
- `src/tests/uploads/upload-flow.test.ts`: 10/10 passed (end-to-end direct storage upload, signed URLs, queuing, soft deletion)
- `src/tests/uploads/validation-quota.test.ts`: 14/14 passed (duplicate SHA-256 detection, hourly client upload quota, magic-byte MIME validation, file size limits)
- `src/tests/uploads/access-isolation.test.ts`: 8/8 passed (cross-firm isolation, cross-client isolation, soft delete visibility, stale upload cleanup)
- `src/lib/uploads/client/__tests__/useDocumentStatus.test.ts`: 16/16 passed
- `src/lib/uploads/client/__tests__/downscale.test.ts`: 11/11 passed
- `src/lib/uploads/client/__tests__/queue.test.ts`: 15/15 passed
- `src/lib/uploads/__tests__/sniff.test.ts`: 37/37 passed
- `src/lib/uploads/__tests__/paths.test.ts`: 18/18 passed
- `src/lib/uploads/__tests__/hash.test.ts`: 14/14 passed

### 2.3 Next.js Route Manifest (`npm run build`)
```
Route (app)
┌ ○ /
├ ○ /_not-found
├ ƒ /app
├ ƒ /app/clients
├   /app/clients/[id]
│ └ ◐ /app/clients/[id]
├   /app/clients/[id]/bills
│ └ ◐ /app/clients/[id]/bills
├   /app/clients/[id]/edit
│ └ ◐ /app/clients/[id]/edit
├ ƒ /app/clients/new
├ ○ /forgot-password
├ ○ /icon
├   /invite/[token]
│ └ ◐ /invite/[token]
├ ○ /login
├ ○ /no-access
├ ƒ /portal
├ ƒ /portal/bills
├ ○ /privacy
├ ○ /reset-password
├ ○ /robots.txt
├ ○ /signup
├ ƒ /sitemap.xml
└ ○ /terms
```

---

## 3. Dev Tooling Verification

1. **Synthetic Bill Fixture Generation**:
   `node scripts/generate-fake-bills.mjs` successfully generated 3 valid binary fixtures:
   - `supabase/fixtures/bills/fake_invoice_1.png` (9,417 bytes)
   - `supabase/fixtures/bills/fake_invoice_2.jpg` (4,034 bytes)
   - `supabase/fixtures/bills/fake_invoice_3.pdf` (1,995 bytes)
2. **Direct Local Upload Simulation**:
   `npm run dev:upload` verified successful upload into Supabase storage and `documents` table with status transition to `queued`.
3. **Cryptographic Duplicate Interception**:
   Second run of `npm run dev:upload` detected and skipped all 3 duplicates via SHA-256 matching.
4. **Stale Upload Cleanup**:
   `npm run uploads:cleanup` verified execution of `cleanupStaleUploads` with safe query boundaries.
