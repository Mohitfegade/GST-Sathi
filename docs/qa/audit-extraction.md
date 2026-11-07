# GST Saathi — Document Extraction & OCR Capabilities Audit (Lane E)

**Author / Reviewer:** Lane E Auditor (Extraction & Pipeline Specialist)  
**Target Repository:** `mysterious-bose` (GST Saathi Platform)  
**Date:** November 2026  
**Artifact File:** `docs/qa/audit-extraction.md`  
**Execution Environment:** Next.js 16.4.3 (Turbopack, App Router), PostgreSQL 15 (Supabase Local), Node.js, Vitest 5.0.5  
**Audit Scope:** Document Ingestion, Queueing, Extraction Pipeline, Providers, Database Migrations, UI Review Workbench, Evaluation Harness, and Configuration  
**Overall Verdict:** **FOUNDATIONAL SCHEMAS READY · ENGINE & WORKER UNIMPLEMENTED (Phase 3 Staged, Phase 4 Pending)**

---

## 1. Executive Summary & Verification Scorecard

An exhaustive architectural and implementation audit was conducted across the document extraction and optical character recognition (OCR) capabilities of the GST Saathi repository. The audit reviewed database migrations, extraction adapters, queue pipelines, background workers, cron route handlers, correction interfaces, evaluation harnesses, flag messages, and runtime environment configurations.

### Architectural Context
GST Saathi's development roadmap (`docs/PROMPT_PLAN.md`) partitions document processing across distinct evolutionary phases:
- **Phase 3 (Prompts 06–08):** Document upload, quota enforcement, storage isolation, and queue staging. (*Implemented & Verified*)
- **Phase 4 (Prompts 09–11):** Bill parsing, OCR extraction engine (header & tax), line-item parser/HSN classifier, and split-screen correction workbench. (*Not Yet Implemented / Future Milestone*)

The repository currently contains the complete relational data contract for extraction (`public.extraction_fields`) and upload lifecycle transitions (`public.documents.status`). However, the **execution engine** (OCR providers, worker daemons, cron routes, and evaluation harnesses) is intentionally unstaged, represented by non-blocking architectural stubs.

### Verification Scorecard

| Component / Subsystem | Required Capability | Implementation Status | Artifact / File Location | Status / Verdict |
|---|---|---|---|:---:|
| **1. Database Migrations** | Document and extraction tables, confidence scores, bounding boxes, RLS policies, Migration 130 or equivalent. | **Partial / Schema Only**<br>Migration 040 creates `extraction_fields`. Migration 020/120 handles documents. Migration 130 does not exist. | `supabase/migrations/20261101000040_extraction.sql`<br>`supabase/migrations/20261101000120_uploads.sql` | 🟡 **STAGED (SCHEMA)** |
| **2. Extraction Providers** | OCR / Multimodal LLM providers (Mock, Gemini, Anthropic, or equivalent). | **Missing / Unimplemented**<br>Neither `src/lib/ocr/` nor `src/lib/extraction/` exists. No external AI SDK dependencies. | None (`src/lib/domain/extraction.ts` defines Zod types only) | 🔴 **NOT IMPLEMENTED** |
| **3. Pipeline & Enqueue** | Enqueueing confirmed uploads for background worker extraction. | **Stub Implementation**<br>`enqueueExtraction` returns `{ queued: true }` without dispatching to a queue broker. | `src/lib/uploads/enqueue.ts` | 🟡 **STUBBED** |
| **4. Worker Process & Cron** | Background worker, pg_cron, or Next.js route handler (`/api/cron/...`). | **Missing / Unimplemented**<br>No worker thread, no cron handler in `src/app/api/`, no cron in `vercel.json`. | None | 🔴 **NOT IMPLEMENTED** |
| **5. Detail / Review Page** | Split-screen correction workbench with bounding boxes and field validation. | **Missing / Unimplemented**<br>Only document list and raw signed preview link exist; no interactive inspection view. | `src/app/(app)/app/clients/[id]/bills/page.tsx`<br>`src/components/uploads/DocumentList.tsx` | 🔴 **NOT IMPLEMENTED** |
| **6. Evaluation Harness** | `extraction:eval` script, test fixture runner, field accuracy metrics (Levenshtein, F1). | **Missing / Unimplemented**<br>No `extraction:eval` in `package.json` or `scripts/`. Fixture files exist in `supabase/fixtures/bills/`. | `supabase/fixtures/bills/`<br>`package.json` | 🔴 **NOT IMPLEMENTED** |
| **7. Flag & Status Messages** | Human-readable status badges and plain-English messaging for dual personas. | **Implemented & Verified**<br>Complete plain-English labels and accessible non-color-only border styles. | `src/lib/uploads/status-labels.ts`<br>`src/lib/uploads/messages.ts` | 🟢 **PASS** |
| **8. Environment Config** | Extraction provider keys configured in `.env.local` without secret leaks. | **Clean / Verified**<br>No provider keys in `.env.local` or `.env.example`. Zero credential exposure. | `.env.local`<br>`.env.example` | 🟢 **PASS (NO LEAKS)** |

---

## 2. Deep-Dive Review by Audit Component

### 2.1 Database Migrations for Document Extraction

#### Migration Inventory Analysis
The database migration sequence in `supabase/migrations/` comprises 13 migration files:
```text
20261101000000_base.sql
20261101000010_tenancy.sql
20261101000020_documents.sql
20261101000030_purchases.sql
20261101000040_extraction.sql
20261101000050_gstr2b.sql
20261101000060_reconciliation.sql
20261101000070_sales_returns.sql
20261101000080_rules.sql
20261101000090_audit_alerts.sql
20261101000100_invites.sql
20261101000110_client_support.sql
20261101000120_uploads.sql
```

#### Detailed Findings on Extraction Relational Entities

1. **Migration 130 Status:**
   - **Finding:** There is **no Migration 130** (e.g. `20261101000130_...`) present in `supabase/migrations/`.
   - The final migration in the repository is `20261101000120_uploads.sql` (Migration 120).

2. **Migration 040 (`20261101000040_extraction.sql`):**
   - Migration 040 implements the core schema for AI-extracted and user-corrected fields:
     ```sql
     create table public.extraction_fields (
       id uuid primary key default gen_random_uuid(),
       document_id uuid not null references public.documents(id) on delete cascade,
       invoice_id uuid references public.invoices(id) on delete cascade,
       field_path text not null, -- e.g. 'invoice_no', 'invoice_date', 'total', 'lines[0].hsn'
       ai_initial_value text,
       confidence numeric(4,3) check (confidence >= 0 and confidence <= 1.000),
       bbox jsonb, -- bounding box {x, y, w, h}
       final_value text,
       modified_by uuid references auth.users(id) on delete set null,
       modified_at timestamptz,
       model_version text,
       rule_snapshot_id uuid,
       created_at timestamptz not null default clock_timestamp(),
       updated_at timestamptz not null default clock_timestamp(),
       deleted_at timestamptz
     );
     ```
   - **Field Path Precision:** Supports dot and array notation (`header.invoice_no`, `lines[0].hsn`, `tax.cgst_amount`).
   - **Confidence Representation:** `numeric(4,3)` enforces fixed-precision numbers strictly bounded between `0.000` and `1.000`.
   - **Spatial Bounding Box:** Stored in `bbox` as JSONB (`{x, y, w, h, page}`).
   - **Human-in-the-Loop Audit Trail:** Tracks both `ai_initial_value` and `final_value`, recording `modified_by` and `modified_at`.
   - **RLS Security:** RLS is strictly enabled with four isolated policies (`extraction_fields_select`, `extraction_fields_insert`, `extraction_fields_update`, `extraction_fields_delete`) scoped via `documents` to firm members and platform administrators.

3. **Migration 020 (`20261101000020_documents.sql`) & Enums (`20261101000000_base.sql`):**
   - Defines `doc_status`: `'uploaded'`, `'queued'`, `'processing'`, `'needs_review'`, `'done'`, `'failed'`.
   - Defines `inv_source`: `'extracted'`, `'manual'`, `'imported'`.
   - Defines `public.documents` table with cryptographic SHA-256 fingerprinting, tenant references (`firm_id`, `client_id`), and storage pathing.

4. **Migration 120 (`20261101000120_uploads.sql`):**
   - Establishes `confirm_document_upload(document_id_param)` which transitions a document from `'uploaded'` to `'queued'` once storage upload is validated.
   - Establishes `fail_document_upload(document_id_param, reason)` which transitions document status to `'failed'`.

5. **Missing Migration Elements for Extraction:**
   - No queue table or job state table (e.g. `extraction_jobs`, `job_queue`).
   - No database RPC for worker claiming/locking (e.g. `claim_extraction_job`, `dequeue_document_job` with `FOR UPDATE SKIP LOCKED`).
   - No pgTAP test file specifically exercising `extraction_fields` RLS policies (existing test suites cover `documents`, `invoices`, and `uploads`).

---

### 2.2 Extraction Providers & OCR Engines

#### Filesystem & Architecture Inspection
- Checked paths:
  - `src/lib/ocr/` — **Does not exist**
  - `src/lib/extraction/` — **Does not exist**
- Grep analysis across all source code (`src/**/*.ts`, `src/**/*.tsx`) for provider references (`gemini`, `anthropic`, `openai`, `tesseract`, `vision`):
  - **Result:** No third-party LLM or vision provider integrations exist in the repository.

#### Domain Model Layer (`src/lib/domain/extraction.ts`)
While execution code is absent, the domain layer contains a fully typed, validated schema using Zod:
- `boundingBoxSchema`:
  ```typescript
  export const boundingBoxSchema = z.object({
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number(),
    page: z.number().int().positive().optional(),
  });
  ```
- `confidenceSchema`: Accepts `number` between 0 and 1 or regex `^(0(\.\d{1,3})?|1(\.0{1,3})?)$`.
- `extractionFieldSchema`, `extractionFieldInsertSchema`, `extractionFieldUpdateSchema`: Model complete lifecycle of extraction records.
- Re-exported centrally in `src/lib/domain/index.ts`. Schema synchronization tool (`scripts/check-schema-sync.mjs`) confirms 100% parity between migration table `extraction_fields` and `src/lib/domain/extraction.ts`.

#### Adapter Layer (`src/lib/adapters/`)
- `bill-source.ts` defines `BillSourceAdapter` and `InMemoryBillSourceAdapter` with `uploadBill` and `getBill` methods for storing/retrieving raw file buffers.
- There are **no extraction adapters** (e.g. `ExtractionAdapter`, `MockExtractor`, `GeminiExtractor`, `AnthropicExtractor`).

#### Package Dependencies
Inspection of `package.json` confirms no vision or generative AI dependencies are installed:
```json
"dependencies": {
  "@supabase/ssr": "^0.12.7",
  "@supabase/supabase-js": "^2.118.0",
  "next": "16.4.3",
  "react": "19.3.0",
  "react-dom": "19.3.0",
  "server-only": "^0.0.1",
  "zod": "^4.6.7"
}
```

---

### 2.3 Pipeline, Worker, Cron Route, Detail Page, and Flag Messages

#### 1. Enqueue Pipeline (`src/lib/uploads/enqueue.ts`)
The upload confirmation flow invokes `enqueueExtraction(documentId)`:
```typescript
/**
 * Enqueue a confirmed document for background text/data extraction.
 *
 * THIS TASK ONLY: Stub implementation.
 * Currently marks or confirms document status as 'queued'.
 * A subsequent feature prompt replaces this with the actual queue/worker implementation.
 */
export async function enqueueExtraction(documentId: string): Promise<{ queued: boolean; documentId: string }> {
  return {
    queued: true,
    documentId,
  };
}
```
- **Finding:** This is an explicit architectural placeholder. It marks the document as queued (done inside `confirm_document_upload` RPC) but does not dispatch work to an asynchronous queue broker (such as pgmq, Redis, Celery, or QStash).

#### 2. Worker Process
- **Finding:** No background worker process exists in `scripts/`, `src/workers/`, or elsewhere.
- Documents transitioning to `'queued'` remain in `'queued'` status indefinitely unless manually altered in the database.

#### 3. Cron Route Handlers
- Checked `src/app/` for API routes:
  - There is no `src/app/api/` directory.
  - No cron route handlers (e.g. `src/app/api/cron/process-extractions/route.ts`) exist.
- Checked `vercel.json`:
  ```json
  {
    "$schema": "https://openapi.vercel.sh/vercel.json",
    "framework": "nextjs"
  }
  ```
  - No Vercel Cron jobs are defined.

#### 4. Detail Page & Split-Screen Review Workbench
- Checked client bills routing:
  - Staff route: `src/app/(app)/app/clients/[id]/bills/page.tsx`
  - Portal route: `src/app/(portal)/portal/bills/page.tsx`
- **UI Behavior:**
  - Both routes display a document list (`<DocumentList />`), file filter tabs, and an upload panel (`<UploadPanel />`).
  - Actions available on individual documents:
    1. **Preview / Download:** Triggers `createPreviewUrl` server action, opening the file in a new browser tab with a 5-minute signed Supabase Storage URL.
    2. **Soft Delete:** Marks document `deleted_at`.
  - **Finding:** There is **no document detail page** (e.g. `/bills/[billId]` or a drawer overlay).
  - There is **no split-screen workbench** showing document preview alongside extracted header fields (GSTIN, Invoice #, Date, Total, CGST, SGST, IGST) or line items.
  - There is **no visual bounding box overlay** rendering spatial coordinates on top of invoice PDFs or canvas images.

#### 5. Flag Messages & Status Badges
- Defined in `src/lib/uploads/status-labels.ts` and `src/lib/uploads/messages.ts`:
  - **Persona-Tailored Statuses:**
    | Status | Accountant Label | SME Client Owner Label | Border Style (WCAG Non-Color Indicator) |
    |---|---|---|---|
    | `uploaded` | Uploaded | Received | `dotted` |
    | `queued` | Queued | Received | `dashed` |
    | `processing` | Reading | Being read | `double` |
    | `needs_review` | Needs review | Needs a look | `groove` |
    | `done` | Done | Checked | `solid` |
    | `failed` | Failed | Could not read, please take the photo again | `ridge` |
  - **Error & Guidance Messaging:** High quality, empathetic, plain-English strings for non-technical shop owners (avoiding raw error codes, hash terms, or technical jargon).
  - **Client Polling:** `useDocumentStatus.ts` polls every 3 seconds for documents in non-final statuses (`uploaded`, `queued`, `processing`), ready to reflect real-time progress once workers are attached.

---

### 2.4 Evaluation Harness & `extraction:eval` Audit

#### 1. Script Availability Check
- Checked `package.json`:
  ```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "typecheck": "tsc --noEmit",
    "check-tokens": "node scripts/check-tokens.mjs",
    "dev:invite": "node scripts/dev-invite.mjs",
    "dev:upload": "node scripts/dev-upload.mjs",
    "uploads:cleanup": "node scripts/cleanup-uploads.mjs",
    "db:start": "supabase start",
    "db:reset": "supabase db reset",
    "db:seed:clients": "node scripts/seed-clients.mjs",
    "db:types": "supabase gen types typescript --local > src/lib/database.types.ts",
    "db:test": "supabase test db",
    "test": "vitest run",
    "check:schema": "node scripts/check-schema-sync.mjs"
  }
  ```
  - **Finding:** `extraction:eval` is **not present** in `package.json`.
- Checked `scripts/` directory:
  - Files present: `check-schema-sync.mjs`, `check-tokens.mjs`, `cleanup-uploads.mjs`, `dev-invite.mjs`, `dev-upload.mjs`, `generate-fake-bills.mjs`, `seed-clients.mjs`, `seed-fixtures.mjs`, `smoke-test.mjs`.
  - **Finding:** No evaluation script (e.g. `eval-extraction.mjs` or `scripts/extraction-eval.ts`) exists.

#### 2. Evaluation on Synthetic / Fake Fixtures
- Bill fixtures are present in `supabase/fixtures/bills/`:
  - `fake_invoice_1.png` (PNG image with synthetic bill text and FAKE watermark)
  - `fake_invoice_2.jpg` (JPEG image with synthetic bill text and FAKE watermark)
  - `fake_invoice_3.pdf` (PDF-1.4 document with synthetic bill text and table)
- Generated deterministically by `scripts/generate-fake-bills.mjs`.
- **Finding:** While synthetic bill fixtures exist for upload testing (`dev-upload.mjs`), **no extraction evaluation could be run** because there is neither an eval harness script nor a mock extraction engine to process the fixtures and calculate accuracy metrics.

---

### 2.5 Environment Variables & Provider Configuration Audit

#### Security Guidelines Observed
In strict adherence to the project audit rules:
- **No secret key values are printed or disclosed.**
- Only environment variable names / key identifiers are documented below.

#### Variable Name Inventory

| Variable Name | Location | Present / Populated | Category / Purpose |
|---|---|:---:|---|
| `NEXT_PUBLIC_APP_URL` | `.env.local`, `.env.example` | Yes | Application base URL |
| `NEXT_PUBLIC_SITE_URL` | `.env.local`, `.env.example` | Yes | Canonical site URL |
| `NODE_ENV` | `.env.local`, `.env.example` | Yes | Runtime environment (`development`) |
| `NEXT_PUBLIC_CONTACT_EMAIL` | `.env.local`, `.env.example` | Yes | Contact & support email |
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local`, `.env.example` | Yes | Local Supabase gateway |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env.local`, `.env.example` | Yes | Client anonymous public key |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local`, `.env.example` | Yes | Administrative service role key |
| `VERCEL_OIDC_TOKEN` | `.env.local` | Yes | Vercel deployment token |
| `GEMINI_API_KEY` | — | **Missing** | Not present in any env file |
| `ANTHROPIC_API_KEY` | — | **Missing** | Not present in any env file |
| `OPENAI_API_KEY` | — | **Missing** | Not present in any env file |
| `EXTRACTION_PROVIDER` | — | **Missing** | Not configured |
| `OCR_ENGINE` | — | **Missing** | Not configured |

- **Finding:** `.env.local` contains standard Supabase local development credentials and application URLs. No AI model provider credentials or OCR service keys are configured or referenced anywhere in the environment configuration.

---

## 3. Comprehensive Gap Analysis & Roadmap Alignment

To give the development team a clear, actionable picture of what is needed to implement Prompt 09–11 (Phase 4), the gap analysis below maps current status against future deliverables:

```
[Uploaded Document]
       │
       ▼
confirm_document_upload (RPC)  ──► Status: 'queued'
       │
       ▼
enqueueExtraction (Stub)       ──► [GAP: No queue dispatch]
       │
       ▼
[GAP: Worker / Cron Route]     ──► No background consumer
       │
       ▼
[GAP: Extraction Provider]     ──► No Gemini / Claude / Mock OCR
       │
       ▼
[public.extraction_fields]     ──► Schema READY in DB (Migration 040)
       │
       ▼
[GAP: Review Workbench UI]     ──► No split-screen / bbox viewer
```

### Gap Details by Phase 4 Prompts

| Roadmap Milestone | Target Deliverable | Current Repo Status | Work Required |
|---|---|---|---|
| **Prompt 09: Bill Header & Tax Extraction Engine** | `src/lib/ocr/extractor.ts`<br>Extract Supplier GSTIN, Inv No, Date, Taxable, CGST, SGST, IGST, Total. | Not implemented. Domain schemas ready in `extraction.ts`. | 1. Implement OCR adapter (e.g. Gemini 1.5 Flash / Claude 3.5 Sonnet / Mock).<br>2. Build regex & spatial proximity parser.<br>3. Populate `extraction_fields` table with confidence & bboxes. |
| **Prompt 10: Line-Item Parser & HSN Classifier** | `src/lib/ocr/line_items.ts`<br>Extract tabular rows, HSN codes, rates, quantities. | Not implemented. | 1. Implement bounding-box tabular grouper.<br>2. Insert records into `invoice_lines` with link to `extraction_fields`. |
| **Prompt 11: Split-Screen Correction Workbench** | `src/app/(app)/app/clients/[id]/bills/[billId]/page.tsx`<br>Side-by-side bill image with editable fields and visual bboxes. | Not implemented. Only basic table list and 5-min raw preview link exist. | 1. Implement `/bills/[billId]` route.<br>2. Build PDF/Image canvas viewer with bounding box overlay.<br>3. Add field correction forms updating `final_value`, `modified_by`, and `modified_at`. |
| **Worker Infrastructure (Migration 130)** | Background worker, queue leasing RPC, or Next.js cron route. | Not implemented. | 1. Migration for job locking (e.g. `pg_cron` or pgmq queue).<br>2. Worker runner or Next.js route `/api/cron/process-extractions`. |
| **Evaluation Harness** | `npm run extraction:eval`<br>Accuracy benchmark on synthetic dataset. | Not implemented. | 1. Add `scripts/extraction-eval.mjs`.<br>2. Define ground-truth labels for fixtures in `supabase/fixtures/bills/`.<br>3. Compute field-level accuracy and Levenshtein metrics. |

---

## 4. Audit Conclusions & Recommendations

1. **Schema Integrity is High:** The relational groundwork in PostgreSQL (`public.extraction_fields`, `public.documents`, `public.invoices`) is sound, cleanly indexed, and strictly guarded by row-level security policies.
2. **Type Safety is Fully Prepared:** `src/lib/domain/extraction.ts` provides rigorous Zod validation for bounding boxes, confidence scores, and field paths, verified by `scripts/check-schema-sync.mjs`.
3. **Engine is Awaiting Phase 4:** The missing providers, worker, review workbench, and evaluation harness are consistent with the staged prompt plan (`docs/PROMPT_PLAN.md`). Phase 3 (Uploads & Storage) is production-ready; Phase 4 (Extraction Engine) is ready to begin implementation when scheduled.
4. **Environment Hygiene is Pristine:** No leaked API keys or secret credentials were found.
