# Database Architecture, Schema, and RLS Audit Report

**Auditor Role:** Lane D (Parallel Read-Only Database Auditor)  
**Project:** GST Saathi (Mysterious Bose)  
**Project Root:** `C:\Users\aksha\Downloads\GST-Sathi-main\GST-Sathi-main`  
**Target File:** `docs/qa/audit-db.md`  
**Audit Date:** November 7, 2026  
**Audit Classification:** READ-ONLY COMPREHENSIVE REPOSITORY AUDIT  

---

## 1. Executive Summary & Verification Status

This audit report provides an exhaustive, authoritative assessment of the database architecture, Supabase migrations, schema tables, columns, indexes, Row Level Security (RLS) policies, database triggers, stored functions, and pgTAP test suites for the GST Saathi application.

### 1.1 Docker & Local Supabase Daemon Status

| Component | Status | Command Verified | Result Summary |
|---|---|---|---|
| **Docker Engine** | **NOT INSTALLED / DOWN** | `docker info` / `docker ps` | `docker : The term 'docker' is not recognized as the name of a cmdlet, function, script file, or operable program.` |
| **Local Supabase DB** | **NOT RUNNING** | Docker dependency check | Docker daemon is missing; Supabase local container stack cannot start. |
| **`npm run db:reset`** | **NOT RUN** | Script precondition check | Marked **NOT RUN** due to missing Docker engine. |
| **`npm run db:test`** | **NOT RUN** | Script precondition check | Marked **NOT RUN** due to missing Docker engine. |

> [!IMPORTANT]
> **Strict Audit Protocol Notice:** In accordance with strict auditing guidelines, DB-dependent runtime execution checks (`npm run db:reset` and `npm run db:test`) were **NOT RUN**. Antigravity will never claim a runtime test passed without live execution. However, complete static source inspection of all 6 pgTAP test suites (301 planned assertions) and all 13 migration SQL files was completed.

### 1.2 Schema Architecture Inventory

| Metric | Count | Details |
|---|---|---|
| **Migration Files** | **13** | Sequential versioned migrations from `000_base` to `120_uploads` |
| **Public Schema Tables** | **25** | Core tenancy, documents, purchases, extraction, GSTR-2B, reconciliation, sales, returns, rules, audit, and invites |
| **Row Level Security (RLS)** | **25 / 25 (100%)** | **Every single table** has `ENABLE ROW LEVEL SECURITY` explicitly configured |
| **Total Table RLS Policies** | **91** | Defined across migrations (89 active unique table policies after migration 110 overrides) |
| **Storage RLS Policies** | **4** | Applied to `storage.objects` for the private `documents` bucket |
| **Index Creation Statements** | **102** | 101 unique named B-tree and partial indexes across 24 tables (plus 25 Primary Key indexes) |
| **PostgreSQL Custom ENUMs** | **24** | Strongly-typed domain enums covering GST schemes, roles, filing statuses, and doc kinds |
| **PL/pgSQL Functions** | **17** | Security-definer helpers, trigger handlers, and transactional client RPCs (all hardened with `set search_path = ''`) |
| **Database Triggers** | **28** | Automated `updated_at` updates, append-only immutability enforcement, and audit trail capture |
| **pgTAP Test Assertions** | **301** | Across 6 test suites ready for regression execution upon Docker initialization |
| **Domain Model Parity** | **25 / 25 (100%)** | Verified via `node scripts/check-schema-sync.mjs` against TypeScript domain models |

---

## 2. Environment & Test Suite Review

### 2.1 Live Docker Execution Verification

To verify whether local database operations could be executed, standard Docker status commands were run:

```powershell
PS C:\Users\aksha\Downloads\GST-Sathi-main> docker info
docker : The term 'docker' is not recognized as the name of a cmdlet, function, script file, or operable program. 
Check the spelling of the name, or if a path was included, verify that the path is correct and try again.
At line:1 char:1
+ docker info
+ ~~~~~~
    + CategoryInfo          : ObjectNotFound: (docker:String) [], CommandNotFoundException
    + FullyQualifiedErrorId : CommandNotFoundException

PS C:\Users\aksha\Downloads\GST-Sathi-main> docker ps
docker : The term 'docker' is not recognized as the name of a cmdlet, function, script file, or operable program. 
Check the spelling of the name, or if a path was included, verify that the path is correct and try again.
At line:1 char:1
+ docker ps
+ ~~~~~~
    + CategoryInfo          : ObjectNotFound: (docker:String) [], CommandNotFoundException
    + FullyQualifiedErrorId : CommandNotFoundException
```

**Finding:** Docker is not installed or not exposed on system `PATH` on this host. Consequently:
- `npm run db:reset` (`supabase db reset`): **NOT RUN**
- `npm run db:test` (`supabase test db`): **NOT RUN**

### 2.2 Static pgTAP Test Suite Inventory

The project includes an extensive pgTAP test harness in `supabase/tests/`. Each test file uses transactional rollbacks (`begin;` / `rollback;`) to test RLS isolation, negative security boundaries, and authorization bypasses:

| Test Suite File | Planned Tests | Primary Security Boundaries Tested |
|---|---|---|
| `rls_tenancy_documents_purchases.test.sql` | 60 | Multi-tenant isolation for firms, firm members, clients, client access, documents, and purchases (invoices, suppliers, lines, payments). |
| `rls_recon_sales_returns_alerts.test.sql` | 38 | GSTR-2B imports, reconciliation runs & results, sales entries & invoices, return periods, drafts, and compliance alerts. |
| `rls_rules_audit_storage.test.sql` | 73 | Append-only immutability of `audit_events` and `rule_snapshots`, global `gst_rate_rules`, `rule_params`, and storage object path isolation. |
| `rls_invites.test.sql` | 54 | SME invite token creation (`create_client_invite`), unauthenticated token peeking (`peek_client_invite`), single-use redemption (`accept_client_invite`), and firm admin lifecycle controls. |
| `rls_client_support.test.sql` | 30 | Active GSTIN uniqueness enforcement, legal/trade name search indexes, non-admin archive/restore blocking via `check_client_archive_permission()`, and immutable accepted invite protection. |
| `rls_uploads.test.sql` | 46 | Direct-to-storage upload pipeline: quota checks (100 docs/hr), stale unconfirmed cleanup, upload confirmation (`confirm_document_upload`), failure reporting (`fail_document_upload`), and client-owner vs firm isolation. |
| **TOTAL PLANNED ASSERTIONS** | **301** | Comprehensive database security coverage across all operational vectors. |

---

## 3. Sequential Migration History

The database schema is constructed from 13 clean, idempotent, sequential SQL migrations located in `supabase/migrations/`.

| Migration File | Timestamp (UTC) | Sequence Tag | Scope & Description of Changes |
|---|---|---|---|
| `20261101000000_base.sql` | 2026-11-01 00:00:00 | `base` | Enables `pgcrypto` extension; declares 24 domain ENUM types; defines global `set_updated_at()` trigger function; implements security-definer helper functions (`is_firm_member`, `is_firm_admin`, `has_client_access`, `is_client_owner`, `is_platform_admin`) with search path hardening. |
| `20261101000010_tenancy.sql` | 2026-11-01 00:00:10 | `tenancy` | Establishes root multi-tenant hierarchy: `firms`, `firm_members`, `clients`, `client_access`, and `platform_admins`. Configures active GSTIN uniqueness, foreign key cascades, updated_at triggers, and initial 17 RLS policies. |
| `20261101000020_documents.sql` | 2026-11-01 00:00:20 | `documents` | Creates `documents` table with client SHA-256 deduplication index; provisions private `documents` storage bucket in `storage.buckets`; defines 4 table RLS policies and 4 storage object RLS policies. |
| `20261101000030_purchases.sql` | 2026-11-01 00:00:30 | `purchases` | Inward purchase accounting schema: `suppliers`, `invoices`, `invoice_lines`, and `invoice_payments`. Establishes partial index on active suppliers per client, normalized invoice number indexes, and 16 RLS policies. |
| `20261101000040_extraction.sql` | 2026-11-01 00:00:40 | `extraction` | Machine extraction table `extraction_fields` for AI OCR bounding boxes, confidence metrics, and human-in-the-loop verified values; updated_at trigger and 4 RLS policies. |
| `20261101000050_gstr2b.sql` | 2026-11-01 00:00:50 | `gstr2b` | Auto-drafted inward statements: `gstr2b_imports` (batch headers) and `gstr2b_records` (line items, IMS actions, normalized doc numbers). 11 B-tree indexes, triggers, and 8 RLS policies. |
| `20261101000060_reconciliation.sql` | 2026-11-01 00:00:60 | `reconciliation` | Core 3-way reconciliation engine: `reconciliation_runs` and `reconciliation_results` (match pass, diff taxable, diff tax, ITC at risk, user decision override). 13 indexes, triggers, and 8 RLS policies. |
| `20261101000070_sales_returns.sql` | 2026-11-01 00:00:70 | `sales_returns` | Outward supply and GST return lifecycle: `sales_entries` (daily/cash/UPI register), `sales_invoices` (outward tax invoices), `return_periods` (GSTR-1, GSTR-3B, CMP-08 filing tracking), and `return_drafts` (versioned JSON payloads). 16 indexes, triggers, and 16 RLS policies. |
| `20261101000080_rules.sql` | 2026-11-01 00:00:80 | `rules` | Global statutory rules: `rule_snapshots` (cryptographic pinning), `gst_rate_rules` (HSN prefix rate schedules), and `rule_params` (turnover and late fee limits). Platform admin-only write policies, public read for authenticated users. |
| `20261101000090_audit_alerts.sql` | 2026-11-01 00:00:90 | `audit_alerts` | Immutability and compliance alerts: `audit_events` (append-only audit log with before/after JSONB snapshots) and `alerts` (compliance deadlines, ITC risk). Implements `prevent_audit_modification()` trigger and `audit_entity_change()` trigger attached to 4 domain tables. |
| `20261101000100_invites.sql` | 2026-11-01 00:01:00 | `invites` | SME client onboarding: `client_invites` table with SHA-256 token hashing; security-definer RPCs (`create_firm_with_admin`, `create_client_invite`, `peek_client_invite`, `accept_client_invite`) granted to authenticated/anon. |
| `20261101000110_client_support.sql` | 2026-11-01 00:01:10 | `client_support` | Client management hardening: case-insensitive search indexes on legal name and trade name; `check_client_archive_permission()` trigger preventing non-admins from soft-deleting/restoring clients; hardened `client_invites` policies requiring `accepted_at is null`. |
| `20261101000120_uploads.sql` | 2026-11-01 00:01:20 | `uploads` | Direct upload pipeline support: composite index on `documents(client_id, status, created_at)`; `check_upload_quota` (max 100/hr); `cleanup_stale_uploads` (soft-deletes unconfirmed docs >1 hr); `confirm_document_upload` and `fail_document_upload` transactional RPCs. |

---

## 4. Database Tables, Columns, Indexes, and RLS Status

The GST Saathi database contains **25 tables** in the `public` schema. All 25 tables have **Row Level Security (RLS) ENABLED**.

### 4.1. Table: `public.alerts`

- **Origin Migration:** `20261101000090_audit_alerts.sql`
- **Row Level Security:** **ENABLED** (`alter table public.alerts enable row level security;`)
- **Primary Key:** `id`
- **Total Columns:** 12
- **Explicit Indexes:** 7
- **Associated RLS Policies:** 4

#### Columns

| Column Name | Data Type & Nullability | Default Value | Notes / Foreign Key Constraints |
|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | **PRIMARY KEY** |
| `firm_id` | `uuid` | None | NOT NULL, FK -> `public.firms(id)` ON DELETE CASCADE |
| `client_id` | `uuid` | None | FK -> `public.clients(id)` ON DELETE CASCADE |
| `kind` | `public.alert_kind` | None | NOT NULL |
| `severity` | `public.severity` | `'info'` | NOT NULL |
| `title` | `text` | None | NOT NULL |
| `body` | `text` | None | NOT NULL |
| `due_date` | `date` | None | - |
| `status` | `public.alert_status` | `'open'` | NOT NULL |
| `created_at` | `timestamptz` | `clock_timestamp()` | NOT NULL |
| `updated_at` | `timestamptz` | `clock_timestamp()` | NOT NULL |
| `deleted_at` | `timestamptz` | None | - |

#### Table Constraints

- `constraint fk_alerts_client_firm foreign key (client_id, firm_id) references public.clients(id, firm_id) on delete cascade`

#### Indexes

| Index Name | Unique | Indexed Columns | Filter Predicate (Partial Index) | Origin Migration |
|---|---|---|---|---|
| `idx_alerts_firm_id` | NO | `(firm_id)` | - | `20261101000090_audit_alerts.sql` |
| `idx_alerts_client_id` | NO | `(client_id)` | - | `20261101000090_audit_alerts.sql` |
| `idx_alerts_status` | NO | `(status)` | - | `20261101000090_audit_alerts.sql` |
| `idx_alerts_due_date` | NO | `(due_date)` | - | `20261101000090_audit_alerts.sql` |
| `idx_alerts_firm_status` | NO | `(firm_id, status)` | `WHERE deleted_at is null` | `20261101000090_audit_alerts.sql` |
| `idx_alerts_client_status` | NO | `(client_id, status)` | `WHERE deleted_at is null` | `20261101000090_audit_alerts.sql` |
| `idx_alerts_active_due` | NO | `(due_date)` | `WHERE status = 'open' and deleted_at is null` | `20261101000090_audit_alerts.sql` |

---

### 4.2. Table: `public.audit_events`

- **Origin Migration:** `20261101000090_audit_alerts.sql`
- **Row Level Security:** **ENABLED** (`alter table public.audit_events enable row level security;`)
- **Primary Key:** `id`
- **Total Columns:** 10
- **Explicit Indexes:** 5
- **Associated RLS Policies:** 2

#### Columns

| Column Name | Data Type & Nullability | Default Value | Notes / Foreign Key Constraints |
|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | **PRIMARY KEY** |
| `firm_id` | `uuid` | None | NOT NULL, FK -> `public.firms(id)` ON DELETE CASCADE |
| `client_id` | `uuid` | None | FK -> `public.clients(id)` ON DELETE CASCADE |
| `actor_id` | `uuid` | None | FK -> `auth.users(id)` ON DELETE SET NULL |
| `action` | `text  )` | None | NOT NULL, CHECK (action in ('INSERT', 'UPDATE', 'DELETE') |
| `entity` | `text` | None | NOT NULL |
| `entity_id` | `uuid` | None | NOT NULL |
| `before` | `jsonb` | None | - |
| `after` | `jsonb` | None | - |
| `created_at` | `timestamptz` | `clock_timestamp()` | NOT NULL |

#### Indexes

| Index Name | Unique | Indexed Columns | Filter Predicate (Partial Index) | Origin Migration |
|---|---|---|---|---|
| `idx_audit_events_firm_id` | NO | `(firm_id, created_at desc)` | - | `20261101000090_audit_alerts.sql` |
| `idx_audit_events_client_id` | NO | `(client_id, created_at desc)` | `WHERE client_id is not null` | `20261101000090_audit_alerts.sql` |
| `idx_audit_events_entity` | NO | `(entity, entity_id)` | - | `20261101000090_audit_alerts.sql` |
| `idx_audit_events_actor_id` | NO | `(actor_id)` | - | `20261101000090_audit_alerts.sql` |
| `idx_audit_events_created_at` | NO | `(created_at desc)` | - | `20261101000090_audit_alerts.sql` |

---

### 4.3. Table: `public.client_access`

- **Origin Migration:** `20261101000010_tenancy.sql`
- **Row Level Security:** **ENABLED** (`alter table public.client_access enable row level security;`)
- **Primary Key:** `id`
- **Total Columns:** 8
- **Explicit Indexes:** 3
- **Associated RLS Policies:** 4

#### Columns

| Column Name | Data Type & Nullability | Default Value | Notes / Foreign Key Constraints |
|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | **PRIMARY KEY** |
| `firm_id` | `uuid` | None | NOT NULL, FK -> `public.firms(id)` ON DELETE CASCADE |
| `client_id` | `uuid` | None | NOT NULL, FK -> `public.clients(id)` ON DELETE CASCADE |
| `user_id` | `uuid` | None | NOT NULL, FK -> `auth.users(id)` ON DELETE CASCADE |
| `role` | `public.client_role` | `'staff'` | NOT NULL |
| `created_at` | `timestamptz` | `clock_timestamp()` | NOT NULL |
| `updated_at` | `timestamptz` | `clock_timestamp()` | NOT NULL |
| `deleted_at` | `timestamptz` | None | - |

#### Table Constraints

- `unique (client_id, user_id)`
- `constraint fk_client_access_client_firm foreign key (client_id, firm_id) references public.clients(id, firm_id) on delete cascade`

#### Indexes

| Index Name | Unique | Indexed Columns | Filter Predicate (Partial Index) | Origin Migration |
|---|---|---|---|---|
| `idx_client_access_firm_id` | NO | `(firm_id)` | - | `20261101000010_tenancy.sql` |
| `idx_client_access_client_id` | NO | `(client_id)` | - | `20261101000010_tenancy.sql` |
| `idx_client_access_user_id` | NO | `(user_id)` | - | `20261101000010_tenancy.sql` |

---

### 4.4. Table: `public.client_invites`

- **Origin Migration:** `20261101000100_invites.sql`
- **Row Level Security:** **ENABLED** (`alter table public.client_invites enable row level security;`)
- **Primary Key:** `id`
- **Total Columns:** 11
- **Explicit Indexes:** 5
- **Associated RLS Policies:** 6

#### Columns

| Column Name | Data Type & Nullability | Default Value | Notes / Foreign Key Constraints |
|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | **PRIMARY KEY** |
| `firm_id` | `uuid` | None | NOT NULL, FK -> `public.firms(id)` ON DELETE CASCADE |
| `client_id` | `uuid` | None | NOT NULL, FK -> `public.clients(id)` ON DELETE CASCADE |
| `token_hash` | `text` | None | NOT NULL, UNIQUE |
| `expires_at` | `timestamptz` | `(clock_timestamp() + interval '7 days')` | NOT NULL |
| `accepted_by` | `uuid` | None | FK -> `auth.users(id)` ON DELETE SET NULL |
| `accepted_at` | `timestamptz` | None | - |
| `created_by` | `uuid` | None | FK -> `auth.users(id)` ON DELETE SET NULL |
| `created_at` | `timestamptz` | `clock_timestamp()` | NOT NULL |
| `updated_at` | `timestamptz` | `clock_timestamp()` | NOT NULL |
| `deleted_at` | `timestamptz` | None | - |

#### Table Constraints

- `constraint fk_client_invites_client_firm foreign key (client_id, firm_id) references public.clients(id, firm_id) on delete cascade`

#### Indexes

| Index Name | Unique | Indexed Columns | Filter Predicate (Partial Index) | Origin Migration |
|---|---|---|---|---|
| `idx_client_invites_firm_id` | NO | `(firm_id)` | - | `20261101000100_invites.sql` |
| `idx_client_invites_client_id` | NO | `(client_id)` | - | `20261101000100_invites.sql` |
| `idx_client_invites_token_hash` | NO | `(token_hash)` | - | `20261101000100_invites.sql` |
| `idx_client_invites_expires_at` | NO | `(expires_at)` | - | `20261101000100_invites.sql` |
| `idx_client_invites_accepted_at` | NO | `(accepted_at)` | - | `20261101000100_invites.sql` |

---

### 4.5. Table: `public.clients`

- **Origin Migration:** `20261101000010_tenancy.sql`
- **Row Level Security:** **ENABLED** (`alter table public.clients enable row level security;`)
- **Primary Key:** `id`
- **Total Columns:** 15
- **Explicit Indexes:** 6
- **Associated RLS Policies:** 4

#### Columns

| Column Name | Data Type & Nullability | Default Value | Notes / Foreign Key Constraints |
|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | **PRIMARY KEY** |
| `firm_id` | `uuid` | None | NOT NULL, FK -> `public.firms(id)` ON DELETE CASCADE |
| `legal_name` | `text` | None | NOT NULL |
| `trade_name` | `text` | None | - |
| `gstin` | `text   = 15 and gstin = upper(gstin))` | None | NOT NULL, CHECK (length(gstin) |
| `state_code` | `text   = 2 and state_code ~ '^[0-9]{2}$')` | None | NOT NULL, CHECK (length(state_code) |
| `scheme` | `public.scheme` | `'regular'` | NOT NULL |
| `aato_band` | `public.aato_band` | `'below_40l'` | NOT NULL |
| `fy_start_month` | `smallint` | `4` | NOT NULL, CHECK (fy_start_month between 1 and 12) |
| `language` | `public.lang` | `'en'` | NOT NULL |
| `sells_exempt` | `boolean` | `false` | NOT NULL |
| `sells_taxable` | `boolean` | `true` | NOT NULL |
| `created_at` | `timestamptz` | `clock_timestamp()` | NOT NULL |
| `updated_at` | `timestamptz` | `clock_timestamp()` | NOT NULL |
| `deleted_at` | `timestamptz` | None | - |

#### Table Constraints

- `constraint uq_clients_id_firm_id unique (id, firm_id)`

#### Indexes

| Index Name | Unique | Indexed Columns | Filter Predicate (Partial Index) | Origin Migration |
|---|---|---|---|---|
| `uq_clients_firm_gstin_active` | **YES** | `(firm_id, gstin)` | `WHERE deleted_at is null` | `20261101000010_tenancy.sql` |
| `idx_clients_firm_id` | NO | `(firm_id)` | - | `20261101000010_tenancy.sql` |
| `uq_clients_firm_gstin_active` | **YES** | `(firm_id, gstin)` | `WHERE deleted_at is null` | `20261101000110_client_support.sql` |
| `idx_clients_firm_legal_name` | NO | `(firm_id, lower(legal_name)` | - | `20261101000110_client_support.sql` |
| `idx_clients_firm_trade_name` | NO | `(firm_id, lower(trade_name)` | - | `20261101000110_client_support.sql` |
| `idx_clients_firm_gstin` | NO | `(firm_id, gstin)` | - | `20261101000110_client_support.sql` |

---

### 4.6. Table: `public.documents`

- **Origin Migration:** `20261101000020_documents.sql`
- **Row Level Security:** **ENABLED** (`alter table public.documents enable row level security;`)
- **Primary Key:** `id`
- **Total Columns:** 15
- **Explicit Indexes:** 8
- **Associated RLS Policies:** 4

#### Columns

| Column Name | Data Type & Nullability | Default Value | Notes / Foreign Key Constraints |
|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | **PRIMARY KEY** |
| `firm_id` | `uuid` | None | NOT NULL, FK -> `public.firms(id)` ON DELETE CASCADE |
| `client_id` | `uuid` | None | NOT NULL, FK -> `public.clients(id)` ON DELETE CASCADE |
| `kind` | `public.doc_kind` | None | NOT NULL |
| `storage_path` | `text` | None | NOT NULL |
| `original_name` | `text` | None | NOT NULL |
| `mime_type` | `text` | None | NOT NULL |
| `size_bytes` | `bigint` | None | NOT NULL, CHECK (size_bytes > 0) |
| `sha256` | `text   = 64)` | None | NOT NULL, CHECK (length(sha256) |
| `status` | `public.doc_status` | `'uploaded'` | NOT NULL |
| `uploaded_by` | `uuid` | None | FK -> `auth.users(id)` ON DELETE SET NULL |
| `period_fp` | `text  = 6 and period_fp ~ '^(0[1-9]|1[0-2])[0-9]{4}$'))` | None | CHECK (period_fp is null or (length(period_fp) |
| `created_at` | `timestamptz` | `clock_timestamp()` | NOT NULL |
| `updated_at` | `timestamptz` | `clock_timestamp()` | NOT NULL |
| `deleted_at` | `timestamptz` | None | - |

#### Table Constraints

- `constraint fk_documents_client_firm foreign key (client_id, firm_id) references public.clients(id, firm_id) on delete cascade`

#### Indexes

| Index Name | Unique | Indexed Columns | Filter Predicate (Partial Index) | Origin Migration |
|---|---|---|---|---|
| `uq_documents_client_sha256_active` | **YES** | `(client_id, sha256)` | `WHERE deleted_at is null` | `20261101000020_documents.sql` |
| `idx_documents_firm_id` | NO | `(firm_id)` | - | `20261101000020_documents.sql` |
| `idx_documents_client_id` | NO | `(client_id)` | - | `20261101000020_documents.sql` |
| `idx_documents_period_fp` | NO | `(period_fp)` | - | `20261101000020_documents.sql` |
| `idx_documents_status` | NO | `(status)` | - | `20261101000020_documents.sql` |
| `idx_documents_kind` | NO | `(kind)` | - | `20261101000020_documents.sql` |
| `idx_documents_uploaded_by` | NO | `(uploaded_by)` | - | `20261101000020_documents.sql` |
| `idx_documents_client_status_created` | NO | `(client_id, status, created_at)` | - | `20261101000120_uploads.sql` |

---

### 4.7. Table: `public.extraction_fields`

- **Origin Migration:** `20261101000040_extraction.sql`
- **Row Level Security:** **ENABLED** (`alter table public.extraction_fields enable row level security;`)
- **Primary Key:** `id`
- **Total Columns:** 15
- **Explicit Indexes:** 4
- **Associated RLS Policies:** 4

#### Columns

| Column Name | Data Type & Nullability | Default Value | Notes / Foreign Key Constraints |
|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | **PRIMARY KEY** |
| `document_id` | `uuid` | None | NOT NULL, FK -> `public.documents(id)` ON DELETE CASCADE |
| `invoice_id` | `uuid` | None | FK -> `public.invoices(id)` ON DELETE CASCADE |
| `field_path` | `text , -- e.g. 'invoice_no', 'invoice_date', 'total', 'lines[0].hsn'` | None | NOT NULL |
| `ai_initial_value` | `text` | None | - |
| `confidence` | `numeric(4,3)` | None | CHECK (confidence >= 0 and confidence <= 1.000) |
| `bbox` | `jsonb, -- bounding box {x, y, w, h}` | None | - |
| `final_value` | `text` | None | - |
| `modified_by` | `uuid` | None | FK -> `auth.users(id)` ON DELETE SET NULL |
| `modified_at` | `timestamptz` | None | - |
| `model_version` | `text` | None | - |
| `rule_snapshot_id` | `uuid` | None | - |
| `created_at` | `timestamptz` | `clock_timestamp()` | NOT NULL |
| `updated_at` | `timestamptz` | `clock_timestamp()` | NOT NULL |
| `deleted_at` | `timestamptz` | None | - |

#### Indexes

| Index Name | Unique | Indexed Columns | Filter Predicate (Partial Index) | Origin Migration |
|---|---|---|---|---|
| `idx_extraction_fields_document_id` | NO | `(document_id)` | - | `20261101000040_extraction.sql` |
| `idx_extraction_fields_invoice_id` | NO | `(invoice_id)` | - | `20261101000040_extraction.sql` |
| `idx_extraction_fields_field_path` | NO | `(field_path)` | - | `20261101000040_extraction.sql` |
| `idx_extraction_fields_modified_by` | NO | `(modified_by)` | - | `20261101000040_extraction.sql` |

---

### 4.8. Table: `public.firm_members`

- **Origin Migration:** `20261101000010_tenancy.sql`
- **Row Level Security:** **ENABLED** (`alter table public.firm_members enable row level security;`)
- **Primary Key:** `id`
- **Total Columns:** 7
- **Explicit Indexes:** 2
- **Associated RLS Policies:** 4

#### Columns

| Column Name | Data Type & Nullability | Default Value | Notes / Foreign Key Constraints |
|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | **PRIMARY KEY** |
| `firm_id` | `uuid` | None | NOT NULL, FK -> `public.firms(id)` ON DELETE CASCADE |
| `user_id` | `uuid` | None | NOT NULL, FK -> `auth.users(id)` ON DELETE CASCADE |
| `role` | `public.firm_role` | `'staff'` | NOT NULL |
| `created_at` | `timestamptz` | `clock_timestamp()` | NOT NULL |
| `updated_at` | `timestamptz` | `clock_timestamp()` | NOT NULL |
| `deleted_at` | `timestamptz` | None | - |

#### Table Constraints

- `unique (firm_id, user_id)`

#### Indexes

| Index Name | Unique | Indexed Columns | Filter Predicate (Partial Index) | Origin Migration |
|---|---|---|---|---|
| `idx_firm_members_firm_id` | NO | `(firm_id)` | - | `20261101000010_tenancy.sql` |
| `idx_firm_members_user_id` | NO | `(user_id)` | - | `20261101000010_tenancy.sql` |

---

### 4.9. Table: `public.firms`

- **Origin Migration:** `20261101000010_tenancy.sql`
- **Row Level Security:** **ENABLED** (`alter table public.firms enable row level security;`)
- **Primary Key:** `id`
- **Total Columns:** 6
- **Explicit Indexes:** 1
- **Associated RLS Policies:** 4

#### Columns

| Column Name | Data Type & Nullability | Default Value | Notes / Foreign Key Constraints |
|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | **PRIMARY KEY** |
| `name` | `text` | None | NOT NULL |
| `created_by` | `uuid` | None | FK -> `auth.users(id)` ON DELETE SET NULL |
| `created_at` | `timestamptz` | `clock_timestamp()` | NOT NULL |
| `updated_at` | `timestamptz` | `clock_timestamp()` | NOT NULL |
| `deleted_at` | `timestamptz` | None | - |

#### Indexes

| Index Name | Unique | Indexed Columns | Filter Predicate (Partial Index) | Origin Migration |
|---|---|---|---|---|
| `idx_firms_created_by` | NO | `(created_by)` | - | `20261101000010_tenancy.sql` |

---

### 4.10. Table: `public.gst_rate_rules`

- **Origin Migration:** `20261101000080_rules.sql`
- **Row Level Security:** **ENABLED** (`alter table public.gst_rate_rules enable row level security;`)
- **Primary Key:** `id`
- **Total Columns:** 12
- **Explicit Indexes:** 3
- **Associated RLS Policies:** 4

#### Columns

| Column Name | Data Type & Nullability | Default Value | Notes / Foreign Key Constraints |
|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | **PRIMARY KEY** |
| `hsn_prefix` | `text` | None | NOT NULL |
| `description_pattern` | `text` | None | - |
| `rate` | `numeric(5,2)` | None | NOT NULL, CHECK (rate >= 0 and rate <= 100) |
| `effective_from` | `date` | None | NOT NULL |
| `effective_to` | `date` | None | - |
| `source_ref` | `text` | None | NOT NULL |
| `verified_by_ca` | `boolean` | `false` | NOT NULL |
| `notes` | `text` | None | - |
| `created_at` | `timestamptz` | `clock_timestamp()` | NOT NULL |
| `updated_at` | `timestamptz` | `clock_timestamp()` | NOT NULL |
| `deleted_at` | `timestamptz` | None | - |

#### Table Constraints

- `constraint chk_gst_rate_rules_effective_range check (effective_to is null or effective_to >= effective_from)`

#### Indexes

| Index Name | Unique | Indexed Columns | Filter Predicate (Partial Index) | Origin Migration |
|---|---|---|---|---|
| `idx_gst_rate_rules_hsn_prefix` | NO | `(hsn_prefix)` | - | `20261101000080_rules.sql` |
| `idx_gst_rate_rules_effective_from` | NO | `(effective_from)` | - | `20261101000080_rules.sql` |
| `idx_gst_rate_rules_effective_to` | NO | `(effective_to)` | - | `20261101000080_rules.sql` |

---

### 4.11. Table: `public.gstr2b_imports`

- **Origin Migration:** `20261101000050_gstr2b.sql`
- **Row Level Security:** **ENABLED** (`alter table public.gstr2b_imports enable row level security;`)
- **Primary Key:** `id`
- **Total Columns:** 12
- **Explicit Indexes:** 6
- **Associated RLS Policies:** 4

#### Columns

| Column Name | Data Type & Nullability | Default Value | Notes / Foreign Key Constraints |
|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | **PRIMARY KEY** |
| `firm_id` | `uuid` | None | NOT NULL, FK -> `public.firms(id)` ON DELETE CASCADE |
| `client_id` | `uuid` | None | NOT NULL, FK -> `public.clients(id)` ON DELETE CASCADE |
| `document_id` | `uuid` | None | FK -> `public.documents(id)` ON DELETE SET NULL |
| `return_period_fp` | `text   = 6 and return_period_fp ~ '^(0[1-9]|1[0-2])[0-9]{4}$')` | None | NOT NULL, CHECK (length(return_period_fp) |
| `generated_on` | `timestamptz` | None | NOT NULL |
| `is_recompute` | `boolean` | `false` | NOT NULL |
| `imported_by` | `uuid` | None | FK -> `auth.users(id)` ON DELETE SET NULL |
| `record_count` | `integer` | `0` | NOT NULL, CHECK (record_count >= 0) |
| `created_at` | `timestamptz` | `clock_timestamp()` | NOT NULL |
| `updated_at` | `timestamptz` | `clock_timestamp()` | NOT NULL |
| `deleted_at` | `timestamptz` | None | - |

#### Table Constraints

- `constraint fk_gstr2b_imports_client_firm foreign key (client_id, firm_id) references public.clients(id, firm_id) on delete cascade`

#### Indexes

| Index Name | Unique | Indexed Columns | Filter Predicate (Partial Index) | Origin Migration |
|---|---|---|---|---|
| `idx_gstr2b_imports_firm_id` | NO | `(firm_id)` | - | `20261101000050_gstr2b.sql` |
| `idx_gstr2b_imports_client_id` | NO | `(client_id)` | - | `20261101000050_gstr2b.sql` |
| `idx_gstr2b_imports_return_period_fp` | NO | `(return_period_fp)` | - | `20261101000050_gstr2b.sql` |
| `idx_gstr2b_imports_client_period` | NO | `(client_id, return_period_fp)` | - | `20261101000050_gstr2b.sql` |
| `idx_gstr2b_imports_document_id` | NO | `(document_id)` | - | `20261101000050_gstr2b.sql` |
| `idx_gstr2b_imports_imported_by` | NO | `(imported_by)` | - | `20261101000050_gstr2b.sql` |

---

### 4.12. Table: `public.gstr2b_records`

- **Origin Migration:** `20261101000050_gstr2b.sql`
- **Row Level Security:** **ENABLED** (`alter table public.gstr2b_records enable row level security;`)
- **Primary Key:** `id`
- **Total Columns:** 22
- **Explicit Indexes:** 5
- **Associated RLS Policies:** 4

#### Columns

| Column Name | Data Type & Nullability | Default Value | Notes / Foreign Key Constraints |
|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | **PRIMARY KEY** |
| `import_id` | `uuid` | None | NOT NULL, FK -> `public.gstr2b_imports(id)` ON DELETE CASCADE |
| `section` | `public.gstr2b_section` | `'b2b'` | NOT NULL |
| `supplier_gstin` | `text   = 15 and supplier_gstin = upper(supplier_gstin))` | None | NOT NULL, CHECK (length(supplier_gstin) |
| `supplier_name` | `text` | None | - |
| `doc_no` | `text` | None | NOT NULL |
| `doc_no_norm` | `text` | None | NOT NULL |
| `doc_date` | `date` | None | NOT NULL |
| `doc_type` | `text` | `'INV'` | NOT NULL |
| `taxable_value` | `numeric(14,2)` | `0` | NOT NULL |
| `cgst` | `numeric(14,2)` | `0` | NOT NULL |
| `sgst` | `numeric(14,2)` | `0` | NOT NULL |
| `igst` | `numeric(14,2)` | `0` | NOT NULL |
| `cess` | `numeric(14,2)` | `0` | NOT NULL |
| `itc_available` | `boolean` | `true` | NOT NULL |
| `itc_reason` | `text` | None | - |
| `ims_action` | `public.ims_action` | `'none'` | NOT NULL |
| `ims_action_at` | `timestamptz` | None | - |
| `ims_action_by` | `uuid` | None | FK -> `auth.users(id)` ON DELETE SET NULL |
| `created_at` | `timestamptz` | `clock_timestamp()` | NOT NULL |
| `updated_at` | `timestamptz` | `clock_timestamp()` | NOT NULL |
| `deleted_at` | `timestamptz` | None | - |

#### Indexes

| Index Name | Unique | Indexed Columns | Filter Predicate (Partial Index) | Origin Migration |
|---|---|---|---|---|
| `idx_gstr2b_records_import_id` | NO | `(import_id)` | - | `20261101000050_gstr2b.sql` |
| `idx_gstr2b_records_section` | NO | `(section)` | - | `20261101000050_gstr2b.sql` |
| `idx_gstr2b_records_supplier_gstin` | NO | `(supplier_gstin)` | - | `20261101000050_gstr2b.sql` |
| `idx_gstr2b_records_doc_no_norm` | NO | `(doc_no_norm)` | - | `20261101000050_gstr2b.sql` |
| `idx_gstr2b_records_match` | NO | `(supplier_gstin, doc_no_norm)` | - | `20261101000050_gstr2b.sql` |

---

### 4.13. Table: `public.invoice_lines`

- **Origin Migration:** `20261101000030_purchases.sql`
- **Row Level Security:** **ENABLED** (`alter table public.invoice_lines enable row level security;`)
- **Primary Key:** `id`
- **Total Columns:** 19
- **Explicit Indexes:** 1
- **Associated RLS Policies:** 4

#### Columns

| Column Name | Data Type & Nullability | Default Value | Notes / Foreign Key Constraints |
|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | **PRIMARY KEY** |
| `invoice_id` | `uuid` | None | NOT NULL, FK -> `public.invoices(id)` ON DELETE CASCADE |
| `line_no` | `smallint` | None | NOT NULL |
| `description` | `text` | None | NOT NULL |
| `hsn` | `text` | None | - |
| `qty` | `numeric(12,3)` | `1` | NOT NULL |
| `unit` | `text` | `'NOS'` | NOT NULL |
| `unit_price` | `numeric(14,2)` | `0` | NOT NULL |
| `taxable_value` | `numeric(14,2)` | `0` | NOT NULL |
| `tax_rate` | `numeric(5,2)` | `0` | NOT NULL |
| `cgst` | `numeric(14,2)` | `0` | NOT NULL |
| `sgst` | `numeric(14,2)` | `0` | NOT NULL |
| `igst` | `numeric(14,2)` | `0` | NOT NULL |
| `cess` | `numeric(14,2)` | `0` | NOT NULL |
| `rate_rule_id` | `uuid` | None | - |
| `rate_status` | `public.rate_status` | `'unknown'` | NOT NULL |
| `created_at` | `timestamptz` | `clock_timestamp()` | NOT NULL |
| `updated_at` | `timestamptz` | `clock_timestamp()` | NOT NULL |
| `deleted_at` | `timestamptz` | None | - |

#### Table Constraints

- `unique (invoice_id, line_no)`

#### Indexes

| Index Name | Unique | Indexed Columns | Filter Predicate (Partial Index) | Origin Migration |
|---|---|---|---|---|
| `invoice_lines_invoice_id_idx` | NO | `(invoice_id)` | - | `20261101000030_purchases.sql` |

---

### 4.14. Table: `public.invoice_payments`

- **Origin Migration:** `20261101000030_purchases.sql`
- **Row Level Security:** **ENABLED** (`alter table public.invoice_payments enable row level security;`)
- **Primary Key:** `id`
- **Total Columns:** 9
- **Explicit Indexes:** 1
- **Associated RLS Policies:** 4

#### Columns

| Column Name | Data Type & Nullability | Default Value | Notes / Foreign Key Constraints |
|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | **PRIMARY KEY** |
| `invoice_id` | `uuid` | None | NOT NULL, FK -> `public.invoices(id)` ON DELETE CASCADE |
| `paid_on` | `date` | None | NOT NULL |
| `amount` | `numeric(14,2)` | None | NOT NULL, CHECK (amount > 0) |
| `mode` | `public.pay_mode` | `'bank'` | NOT NULL |
| `reference_no` | `text` | None | - |
| `created_at` | `timestamptz` | `clock_timestamp()` | NOT NULL |
| `updated_at` | `timestamptz` | `clock_timestamp()` | NOT NULL |
| `deleted_at` | `timestamptz` | None | - |

#### Indexes

| Index Name | Unique | Indexed Columns | Filter Predicate (Partial Index) | Origin Migration |
|---|---|---|---|---|
| `invoice_payments_invoice_id_idx` | NO | `(invoice_id)` | - | `20261101000030_purchases.sql` |

---

### 4.15. Table: `public.invoices`

- **Origin Migration:** `20261101000030_purchases.sql`
- **Row Level Security:** **ENABLED** (`alter table public.invoices enable row level security;`)
- **Primary Key:** `id`
- **Total Columns:** 23
- **Explicit Indexes:** 7
- **Associated RLS Policies:** 4

#### Columns

| Column Name | Data Type & Nullability | Default Value | Notes / Foreign Key Constraints |
|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | **PRIMARY KEY** |
| `firm_id` | `uuid` | None | NOT NULL, FK -> `public.firms(id)` ON DELETE CASCADE |
| `client_id` | `uuid` | None | NOT NULL, FK -> `public.clients(id)` ON DELETE CASCADE |
| `supplier_id` | `uuid` | None | FK -> `public.suppliers(id)` ON DELETE SET NULL |
| `document_id` | `uuid` | None | FK -> `public.documents(id)` ON DELETE SET NULL |
| `invoice_no` | `text` | None | NOT NULL |
| `invoice_no_norm` | `text` | None | NOT NULL |
| `invoice_date` | `date` | None | NOT NULL |
| `place_of_supply` | `text   = 2)` | None | NOT NULL, CHECK (length(place_of_supply) |
| `taxable_value` | `numeric(14,2)` | `0` | NOT NULL |
| `cgst` | `numeric(14,2)` | `0` | NOT NULL |
| `sgst` | `numeric(14,2)` | `0` | NOT NULL |
| `igst` | `numeric(14,2)` | `0` | NOT NULL |
| `cess` | `numeric(14,2)` | `0` | NOT NULL |
| `round_off` | `numeric(14,2)` | `0` | NOT NULL |
| `total` | `numeric(14,2)` | `0` | NOT NULL |
| `status` | `public.inv_status` | `'draft'` | NOT NULL |
| `source` | `public.inv_source` | `'extracted'` | NOT NULL |
| `itc_state` | `public.itc_state` | `'eligible'` | NOT NULL |
| `period_fp` | `text   = 6 and period_fp ~ '^(0[1-9]|1[0-2])[0-9]{4}$')` | None | NOT NULL, CHECK (length(period_fp) |
| `created_at` | `timestamptz` | `clock_timestamp()` | NOT NULL |
| `updated_at` | `timestamptz` | `clock_timestamp()` | NOT NULL |
| `deleted_at` | `timestamptz` | None | - |

#### Table Constraints

- `constraint fk_invoices_client_firm foreign key (client_id, firm_id) references public.clients(id, firm_id) on delete cascade`

#### Indexes

| Index Name | Unique | Indexed Columns | Filter Predicate (Partial Index) | Origin Migration |
|---|---|---|---|---|
| `invoices_firm_id_idx` | NO | `(firm_id)` | - | `20261101000030_purchases.sql` |
| `invoices_client_id_idx` | NO | `(client_id)` | - | `20261101000030_purchases.sql` |
| `invoices_supplier_id_idx` | NO | `(supplier_id)` | - | `20261101000030_purchases.sql` |
| `invoices_document_id_idx` | NO | `(document_id)` | - | `20261101000030_purchases.sql` |
| `invoices_period_fp_idx` | NO | `(period_fp)` | - | `20261101000030_purchases.sql` |
| `invoices_invoice_no_norm_idx` | NO | `(invoice_no_norm)` | - | `20261101000030_purchases.sql` |
| `invoices_client_period_idx` | NO | `(client_id, period_fp)` | - | `20261101000030_purchases.sql` |

---

### 4.16. Table: `public.platform_admins`

- **Origin Migration:** `20261101000010_tenancy.sql`
- **Row Level Security:** **ENABLED** (`alter table public.platform_admins enable row level security;`)
- **Primary Key:** `user_id`
- **Total Columns:** 2
- **Explicit Indexes:** 0
- **Associated RLS Policies:** 1

#### Columns

| Column Name | Data Type & Nullability | Default Value | Notes / Foreign Key Constraints |
|---|---|---|---|
| `user_id` | `uuid` | None | **PRIMARY KEY**, FK -> `auth.users(id)` ON DELETE CASCADE |
| `created_at` | `timestamptz` | `clock_timestamp()` | NOT NULL |

---

### 4.17. Table: `public.reconciliation_results`

- **Origin Migration:** `20261101000060_reconciliation.sql`
- **Row Level Security:** **ENABLED** (`alter table public.reconciliation_results enable row level security;`)
- **Primary Key:** `id`
- **Total Columns:** 15
- **Explicit Indexes:** 7
- **Associated RLS Policies:** 4

#### Columns

| Column Name | Data Type & Nullability | Default Value | Notes / Foreign Key Constraints |
|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | **PRIMARY KEY** |
| `run_id` | `uuid` | None | NOT NULL, FK -> `public.reconciliation_runs(id)` ON DELETE CASCADE |
| `invoice_id` | `uuid` | None | FK -> `public.invoices(id)` ON DELETE CASCADE |
| `gstr2b_record_id` | `uuid` | None | FK -> `public.gstr2b_records(id)` ON DELETE CASCADE |
| `status` | `public.recon_status` | None | NOT NULL |
| `match_pass` | `smallint` | `1` | NOT NULL |
| `diff_taxable` | `numeric(14,2)` | `0` | NOT NULL |
| `diff_tax` | `numeric(14,2)` | `0` | NOT NULL |
| `itc_at_risk` | `numeric(14,2)` | `0` | NOT NULL |
| `user_decision` | `public.user_decision` | `'none'` | NOT NULL |
| `decided_by` | `uuid` | None | FK -> `auth.users(id)` ON DELETE SET NULL |
| `decided_at` | `timestamptz` | None | - |
| `created_at` | `timestamptz` | `clock_timestamp()` | NOT NULL |
| `updated_at` | `timestamptz` | `clock_timestamp()` | NOT NULL |
| `deleted_at` | `timestamptz` | None | - |

#### Indexes

| Index Name | Unique | Indexed Columns | Filter Predicate (Partial Index) | Origin Migration |
|---|---|---|---|---|
| `idx_reconciliation_results_run_id` | NO | `(run_id)` | - | `20261101000060_reconciliation.sql` |
| `idx_reconciliation_results_invoice_id` | NO | `(invoice_id)` | - | `20261101000060_reconciliation.sql` |
| `idx_reconciliation_results_gstr2b_record_id` | NO | `(gstr2b_record_id)` | - | `20261101000060_reconciliation.sql` |
| `idx_reconciliation_results_status` | NO | `(status)` | - | `20261101000060_reconciliation.sql` |
| `idx_reconciliation_results_run_status` | NO | `(run_id, status)` | - | `20261101000060_reconciliation.sql` |
| `idx_reconciliation_results_user_decision` | NO | `(user_decision)` | - | `20261101000060_reconciliation.sql` |
| `idx_reconciliation_results_decided_by` | NO | `(decided_by)` | - | `20261101000060_reconciliation.sql` |

---

### 4.18. Table: `public.reconciliation_runs`

- **Origin Migration:** `20261101000060_reconciliation.sql`
- **Row Level Security:** **ENABLED** (`alter table public.reconciliation_runs enable row level security;`)
- **Primary Key:** `id`
- **Total Columns:** 13
- **Explicit Indexes:** 6
- **Associated RLS Policies:** 4

#### Columns

| Column Name | Data Type & Nullability | Default Value | Notes / Foreign Key Constraints |
|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | **PRIMARY KEY** |
| `firm_id` | `uuid` | None | NOT NULL, FK -> `public.firms(id)` ON DELETE CASCADE |
| `client_id` | `uuid` | None | NOT NULL, FK -> `public.clients(id)` ON DELETE CASCADE |
| `period_fp` | `text   = 6 and period_fp ~ '^(0[1-9]|1[0-2])[0-9]{4}$')` | None | NOT NULL, CHECK (length(period_fp) |
| `import_id` | `uuid` | None | FK -> `public.gstr2b_imports(id)` ON DELETE SET NULL |
| `status` | `text` | `'started'` | NOT NULL |
| `started_at` | `timestamptz` | `clock_timestamp()` | NOT NULL |
| `finished_at` | `timestamptz` | None | - |
| `summary` | `jsonb` | None | - |
| `rule_snapshot_id` | `uuid` | None | - |
| `created_at` | `timestamptz` | `clock_timestamp()` | NOT NULL |
| `updated_at` | `timestamptz` | `clock_timestamp()` | NOT NULL |
| `deleted_at` | `timestamptz` | None | - |

#### Table Constraints

- `constraint fk_recon_runs_client_firm foreign key (client_id, firm_id) references public.clients(id, firm_id) on delete cascade`

#### Indexes

| Index Name | Unique | Indexed Columns | Filter Predicate (Partial Index) | Origin Migration |
|---|---|---|---|---|
| `idx_reconciliation_runs_firm_id` | NO | `(firm_id)` | - | `20261101000060_reconciliation.sql` |
| `idx_reconciliation_runs_client_id` | NO | `(client_id)` | - | `20261101000060_reconciliation.sql` |
| `idx_reconciliation_runs_period_fp` | NO | `(period_fp)` | - | `20261101000060_reconciliation.sql` |
| `idx_reconciliation_runs_client_period` | NO | `(client_id, period_fp)` | - | `20261101000060_reconciliation.sql` |
| `idx_reconciliation_runs_status` | NO | `(status)` | - | `20261101000060_reconciliation.sql` |
| `idx_reconciliation_runs_import_id` | NO | `(import_id)` | - | `20261101000060_reconciliation.sql` |

---

### 4.19. Table: `public.return_drafts`

- **Origin Migration:** `20261101000070_sales_returns.sql`
- **Row Level Security:** **ENABLED** (`alter table public.return_drafts enable row level security;`)
- **Primary Key:** `id`
- **Total Columns:** 10
- **Explicit Indexes:** 3
- **Associated RLS Policies:** 4

#### Columns

| Column Name | Data Type & Nullability | Default Value | Notes / Foreign Key Constraints |
|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | **PRIMARY KEY** |
| `return_period_id` | `uuid` | None | NOT NULL, FK -> `public.return_periods(id)` ON DELETE CASCADE |
| `version` | `integer` | `1` | NOT NULL |
| `payload` | `jsonb` | `'{}'::jsonb` | NOT NULL |
| `rule_snapshot_id` | `uuid` | None | - |
| `created_by` | `uuid` | None | FK -> `auth.users(id)` ON DELETE SET NULL |
| `approved_by` | `uuid` | None | FK -> `auth.users(id)` ON DELETE SET NULL |
| `created_at` | `timestamptz` | `clock_timestamp()` | NOT NULL |
| `updated_at` | `timestamptz` | `clock_timestamp()` | NOT NULL |
| `deleted_at` | `timestamptz` | None | - |

#### Table Constraints

- `constraint return_drafts_period_version_key unique (return_period_id, version)`

#### Indexes

| Index Name | Unique | Indexed Columns | Filter Predicate (Partial Index) | Origin Migration |
|---|---|---|---|---|
| `idx_return_drafts_return_period_id` | NO | `(return_period_id)` | - | `20261101000070_sales_returns.sql` |
| `idx_return_drafts_created_by` | NO | `(created_by)` | - | `20261101000070_sales_returns.sql` |
| `idx_return_drafts_approved_by` | NO | `(approved_by)` | - | `20261101000070_sales_returns.sql` |

---

### 4.20. Table: `public.return_periods`

- **Origin Migration:** `20261101000070_sales_returns.sql`
- **Row Level Security:** **ENABLED** (`alter table public.return_periods enable row level security;`)
- **Primary Key:** `id`
- **Total Columns:** 12
- **Explicit Indexes:** 5
- **Associated RLS Policies:** 4

#### Columns

| Column Name | Data Type & Nullability | Default Value | Notes / Foreign Key Constraints |
|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | **PRIMARY KEY** |
| `firm_id` | `uuid  , -- denormalised` | None | NOT NULL, FK -> `public.firms(id)` ON DELETE CASCADE |
| `client_id` | `uuid` | None | NOT NULL, FK -> `public.clients(id)` ON DELETE CASCADE |
| `return_type` | `public.return_type` | None | NOT NULL |
| `fp` | `text   = 6 and fp ~ '^(0[1-9]|1[0-2])[0-9]{4}$')` | None | NOT NULL, CHECK (length(fp) |
| `due_date` | `date` | None | NOT NULL |
| `status` | `public.return_status` | `'not_started'` | NOT NULL |
| `filed_on` | `timestamptz` | None | - |
| `ack_ref` | `text` | None | - |
| `created_at` | `timestamptz` | `clock_timestamp()` | NOT NULL |
| `updated_at` | `timestamptz` | `clock_timestamp()` | NOT NULL |
| `deleted_at` | `timestamptz` | None | - |

#### Table Constraints

- `constraint fk_return_periods_client_firm foreign key (client_id, firm_id) references public.clients(id, firm_id) on delete cascade`

#### Indexes

| Index Name | Unique | Indexed Columns | Filter Predicate (Partial Index) | Origin Migration |
|---|---|---|---|---|
| `return_periods_client_return_type_fp_idx` | **YES** | `(client_id, return_type, fp)` | `WHERE deleted_at is null` | `20261101000070_sales_returns.sql` |
| `idx_return_periods_firm_id` | NO | `(firm_id)` | - | `20261101000070_sales_returns.sql` |
| `idx_return_periods_client_id` | NO | `(client_id)` | - | `20261101000070_sales_returns.sql` |
| `idx_return_periods_fp` | NO | `(fp)` | - | `20261101000070_sales_returns.sql` |
| `idx_return_periods_status` | NO | `(status)` | - | `20261101000070_sales_returns.sql` |

---

### 4.21. Table: `public.rule_params`

- **Origin Migration:** `20261101000080_rules.sql`
- **Row Level Security:** **ENABLED** (`alter table public.rule_params enable row level security;`)
- **Primary Key:** `id`
- **Total Columns:** 10
- **Explicit Indexes:** 3
- **Associated RLS Policies:** 4

#### Columns

| Column Name | Data Type & Nullability | Default Value | Notes / Foreign Key Constraints |
|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | **PRIMARY KEY** |
| `key` | `text` | None | NOT NULL |
| `value` | `jsonb` | None | NOT NULL |
| `effective_from` | `date` | None | NOT NULL |
| `effective_to` | `date` | None | - |
| `source_ref` | `text` | None | NOT NULL |
| `verified_by_ca` | `boolean` | `false` | NOT NULL |
| `created_at` | `timestamptz` | `clock_timestamp()` | NOT NULL |
| `updated_at` | `timestamptz` | `clock_timestamp()` | NOT NULL |
| `deleted_at` | `timestamptz` | None | - |

#### Table Constraints

- `unique (key, effective_from)`
- `constraint chk_rule_params_effective_range check (effective_to is null or effective_to >= effective_from)`

#### Indexes

| Index Name | Unique | Indexed Columns | Filter Predicate (Partial Index) | Origin Migration |
|---|---|---|---|---|
| `idx_rule_params_key` | NO | `(key)` | - | `20261101000080_rules.sql` |
| `idx_rule_params_effective_from` | NO | `(effective_from)` | - | `20261101000080_rules.sql` |
| `idx_rule_params_effective_to` | NO | `(effective_to)` | - | `20261101000080_rules.sql` |

---

### 4.22. Table: `public.rule_snapshots`

- **Origin Migration:** `20261101000080_rules.sql`
- **Row Level Security:** **ENABLED** (`alter table public.rule_snapshots enable row level security;`)
- **Primary Key:** `id`
- **Total Columns:** 4
- **Explicit Indexes:** 2
- **Associated RLS Policies:** 2

#### Columns

| Column Name | Data Type & Nullability | Default Value | Notes / Foreign Key Constraints |
|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | **PRIMARY KEY** |
| `label` | `text` | None | NOT NULL |
| `checksum` | `text` | None | NOT NULL |
| `created_at` | `timestamptz` | `clock_timestamp()` | NOT NULL |

#### Indexes

| Index Name | Unique | Indexed Columns | Filter Predicate (Partial Index) | Origin Migration |
|---|---|---|---|---|
| `idx_rule_snapshots_checksum` | NO | `(checksum)` | - | `20261101000080_rules.sql` |
| `idx_rule_snapshots_created_at` | NO | `(created_at desc)` | - | `20261101000080_rules.sql` |

---

### 4.23. Table: `public.sales_entries`

- **Origin Migration:** `20261101000070_sales_returns.sql`
- **Row Level Security:** **ENABLED** (`alter table public.sales_entries enable row level security;`)
- **Primary Key:** `id`
- **Total Columns:** 13
- **Explicit Indexes:** 4
- **Associated RLS Policies:** 4

#### Columns

| Column Name | Data Type & Nullability | Default Value | Notes / Foreign Key Constraints |
|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | **PRIMARY KEY** |
| `firm_id` | `uuid  , -- denormalised` | None | NOT NULL, FK -> `public.firms(id)` ON DELETE CASCADE |
| `client_id` | `uuid` | None | NOT NULL, FK -> `public.clients(id)` ON DELETE CASCADE |
| `entry_date` | `date` | None | NOT NULL |
| `cash_total` | `numeric(14,2)` | `0` | NOT NULL |
| `upi_total` | `numeric(14,2)` | `0` | NOT NULL |
| `taxable_sales` | `numeric(14,2)` | `0` | NOT NULL |
| `exempt_sales` | `numeric(14,2)` | `0` | NOT NULL |
| `source` | `public.sales_source` | `'manual'` | NOT NULL |
| `document_id` | `uuid` | None | FK -> `public.documents(id)` ON DELETE SET NULL |
| `created_at` | `timestamptz` | `clock_timestamp()` | NOT NULL |
| `updated_at` | `timestamptz` | `clock_timestamp()` | NOT NULL |
| `deleted_at` | `timestamptz` | None | - |

#### Table Constraints

- `constraint fk_sales_entries_client_firm foreign key (client_id, firm_id) references public.clients(id, firm_id) on delete cascade`

#### Indexes

| Index Name | Unique | Indexed Columns | Filter Predicate (Partial Index) | Origin Migration |
|---|---|---|---|---|
| `idx_sales_entries_firm_id` | NO | `(firm_id)` | - | `20261101000070_sales_returns.sql` |
| `idx_sales_entries_client_id` | NO | `(client_id)` | - | `20261101000070_sales_returns.sql` |
| `idx_sales_entries_entry_date` | NO | `(entry_date)` | - | `20261101000070_sales_returns.sql` |
| `idx_sales_entries_document_id` | NO | `(document_id)` | - | `20261101000070_sales_returns.sql` |

---

### 4.24. Table: `public.sales_invoices`

- **Origin Migration:** `20261101000070_sales_returns.sql`
- **Row Level Security:** **ENABLED** (`alter table public.sales_invoices enable row level security;`)
- **Primary Key:** `id`
- **Total Columns:** 19
- **Explicit Indexes:** 5
- **Associated RLS Policies:** 4

#### Columns

| Column Name | Data Type & Nullability | Default Value | Notes / Foreign Key Constraints |
|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | **PRIMARY KEY** |
| `firm_id` | `uuid  , -- denormalised` | None | NOT NULL, FK -> `public.firms(id)` ON DELETE CASCADE |
| `client_id` | `uuid` | None | NOT NULL, FK -> `public.clients(id)` ON DELETE CASCADE |
| `invoice_no` | `text` | None | NOT NULL |
| `invoice_date` | `date` | None | NOT NULL |
| `buyer_gstin` | `text  = 15 and buyer_gstin = upper(buyer_gstin)))` | None | CHECK (buyer_gstin is null or (length(buyer_gstin) |
| `buyer_name` | `text` | None | - |
| `place_of_supply` | `text   = 2)` | None | NOT NULL, CHECK (length(place_of_supply) |
| `taxable_value` | `numeric(14,2)` | `0` | NOT NULL |
| `cgst` | `numeric(14,2)` | `0` | NOT NULL |
| `sgst` | `numeric(14,2)` | `0` | NOT NULL |
| `igst` | `numeric(14,2)` | `0` | NOT NULL |
| `cess` | `numeric(14,2)` | `0` | NOT NULL |
| `total` | `numeric(14,2)` | `0` | NOT NULL |
| `doc_type` | `public.sales_doc_type` | `'tax_invoice'` | NOT NULL |
| `status` | `public.inv_status` | `'draft'` | NOT NULL |
| `created_at` | `timestamptz` | `clock_timestamp()` | NOT NULL |
| `updated_at` | `timestamptz` | `clock_timestamp()` | NOT NULL |
| `deleted_at` | `timestamptz` | None | - |

#### Table Constraints

- `constraint fk_sales_invoices_client_firm foreign key (client_id, firm_id) references public.clients(id, firm_id) on delete cascade`

#### Indexes

| Index Name | Unique | Indexed Columns | Filter Predicate (Partial Index) | Origin Migration |
|---|---|---|---|---|
| `idx_sales_invoices_firm_id` | NO | `(firm_id)` | - | `20261101000070_sales_returns.sql` |
| `idx_sales_invoices_client_id` | NO | `(client_id)` | - | `20261101000070_sales_returns.sql` |
| `idx_sales_invoices_invoice_no` | NO | `(invoice_no)` | - | `20261101000070_sales_returns.sql` |
| `idx_sales_invoices_invoice_date` | NO | `(invoice_date)` | - | `20261101000070_sales_returns.sql` |
| `idx_sales_invoices_buyer_gstin` | NO | `(buyer_gstin)` | - | `20261101000070_sales_returns.sql` |

---

### 4.25. Table: `public.suppliers`

- **Origin Migration:** `20261101000030_purchases.sql`
- **Row Level Security:** **ENABLED** (`alter table public.suppliers enable row level security;`)
- **Primary Key:** `id`
- **Total Columns:** 11
- **Explicit Indexes:** 3
- **Associated RLS Policies:** 4

#### Columns

| Column Name | Data Type & Nullability | Default Value | Notes / Foreign Key Constraints |
|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | **PRIMARY KEY** |
| `firm_id` | `uuid` | None | NOT NULL, FK -> `public.firms(id)` ON DELETE CASCADE |
| `client_id` | `uuid` | None | NOT NULL, FK -> `public.clients(id)` ON DELETE CASCADE |
| `gstin` | `text   = 15 and gstin = upper(gstin))` | None | NOT NULL, CHECK (length(gstin) |
| `name` | `text` | None | NOT NULL |
| `filing_status` | `public.filing_status` | `'unknown'` | NOT NULL |
| `last_checked_at` | `timestamptz` | None | - |
| `notes` | `text` | None | - |
| `created_at` | `timestamptz` | `clock_timestamp()` | NOT NULL |
| `updated_at` | `timestamptz` | `clock_timestamp()` | NOT NULL |
| `deleted_at` | `timestamptz` | None | - |

#### Table Constraints

- `constraint fk_suppliers_client_firm foreign key (client_id, firm_id) references public.clients(id, firm_id) on delete cascade`

#### Indexes

| Index Name | Unique | Indexed Columns | Filter Predicate (Partial Index) | Origin Migration |
|---|---|---|---|---|
| `suppliers_client_id_gstin_idx` | **YES** | `(client_id, gstin)` | `WHERE deleted_at is null` | `20261101000030_purchases.sql` |
| `suppliers_firm_id_idx` | NO | `(firm_id)` | - | `20261101000030_purchases.sql` |
| `suppliers_client_id_idx` | NO | `(client_id)` | - | `20261101000030_purchases.sql` |

---

## 5. Row-Level Security (RLS) Policy Catalog

GST Saathi enforces a multi-tenant security perimeter using Row Level Security (RLS). All tenant-scoped tables use a denormalized `firm_id` pattern to achieve $O(1)$ RLS evaluation without recursive joins.

### 5.1 Role-Based Access Hierarchy

1. **Platform Admin (`is_platform_admin()`):** Unrestricted access across all firms and clients.
2. **CA Firm Admin (`is_firm_admin(firm_id)`):** Administrative control over their accounting firm, members, clients, documents, purchases, reconciliations, sales, and return drafts.
3. **CA Firm Staff (`is_firm_member(firm_id)`):** Operational access to create/update client records, import GSTR-2B, run reconciliations, and draft returns.
4. **SME Client Owner (`is_client_owner(client_id)`):** Direct business access restricted strictly to their assigned client organization. Cannot inspect or modify CA firm metadata, members, or other clients.
5. **Anonymous / Unauthenticated (`anon`):** Strictly blocked on all domain tables; permitted only on public token verification RPCs (`peek_client_invite`).

### 5.2 Table RLS Policies Catalog

Below is the complete catalog of all 91 table RLS policies defined across the migration lifecycle.

| Table Name | Policy Name | Command | Target Role | USING Expression | WITH CHECK Expression | Migration File |
|---|---|---|---|---|---|---|
| `firms` | `firms_select` | **SELECT** | `authenticated` | `public.is_firm_member(id) or public.is_platform_admin()` | - | `20261101000010_tenancy.sql` |
| `firms` | `firms_insert` | **INSERT** | `authenticated` | - | `auth.uid() is not null` | `20261101000010_tenancy.sql` |
| `firms` | `firms_update` | **UPDATE** | `authenticated` | `public.is_firm_admin(id) or public.is_platform_admin()` | `public.is_firm_admin(id) or public.is_platform_admin()` | `20261101000010_tenancy.sql` |
| `firms` | `firms_delete` | **DELETE** | `authenticated` | `public.is_firm_admin(id) or public.is_platform_admin()` | - | `20261101000010_tenancy.sql` |
| `firm_members` | `firm_members_select` | **SELECT** | `authenticated` | `public.is_firm_member(firm_id) or public.is_platform_admin()` | - | `20261101000010_tenancy.sql` |
| `firm_members` | `firm_members_insert` | **INSERT** | `authenticated` | - | `public.is_firm_admin(firm_id) or public.is_platform_admin()` | `20261101000010_tenancy.sql` |
| `firm_members` | `firm_members_update` | **UPDATE** | `authenticated` | `public.is_firm_admin(firm_id) or public.is_platform_admin()` | `public.is_firm_admin(firm_id) or public.is_platform_admin()` | `20261101000010_tenancy.sql` |
| `firm_members` | `firm_members_delete` | **DELETE** | `authenticated` | `public.is_firm_admin(firm_id) or public.is_platform_admin()` | - | `20261101000010_tenancy.sql` |
| `clients` | `clients_select` | **SELECT** | `authenticated` | `public.is_firm_member(firm_id) or public.is_client_owner(id) or public.is_platform_admin()` | - | `20261101000010_tenancy.sql` |
| `clients` | `clients_insert` | **INSERT** | `authenticated` | - | `public.is_firm_member(firm_id) or public.is_platform_admin()` | `20261101000010_tenancy.sql` |
| `clients` | `clients_update` | **UPDATE** | `authenticated` | `public.is_firm_member(firm_id) or public.is_platform_admin()` | `public.is_firm_member(firm_id) or public.is_platform_admin()` | `20261101000010_tenancy.sql` |
| `clients` | `clients_delete` | **DELETE** | `authenticated` | `public.is_firm_admin(firm_id) or public.is_platform_admin()` | - | `20261101000010_tenancy.sql` |
| `client_access` | `client_access_select` | **SELECT** | `authenticated` | `public.is_firm_member(firm_id) or user_id = auth.uid() or public.is_platform_admin()` | - | `20261101000010_tenancy.sql` |
| `client_access` | `client_access_insert` | **INSERT** | `authenticated` | - | `public.is_platform_admin() or ( public.is_firm_admin(firm_id) and exists ( select 1 from public.clients c where c.id = client_access.client_id and c.firm_id = client_access.firm_id ) )` | `20261101000010_tenancy.sql` |
| `client_access` | `client_access_update` | **UPDATE** | `authenticated` | `public.is_platform_admin() or ( public.is_firm_admin(firm_id) and exists ( select 1 from public.clients c where c.id = client_access.client_id and c.firm_id = client_access.firm_id ) )` | `public.is_platform_admin() or ( public.is_firm_admin(firm_id) and exists ( select 1 from public.clients c where c.id = client_access.client_id and c.firm_id = client_access.firm_id ) )` | `20261101000010_tenancy.sql` |
| `client_access` | `client_access_delete` | **DELETE** | `authenticated` | `public.is_platform_admin() or ( public.is_firm_admin(firm_id) and exists ( select 1 from public.clients c where c.id = client_access.client_id and c.firm_id = client_access.firm_id ) )` | - | `20261101000010_tenancy.sql` |
| `platform_admins` | `platform_admins_select` | **SELECT** | `authenticated` | `public.is_platform_admin()` | - | `20261101000010_tenancy.sql` |
| `documents` | `documents_select` | **SELECT** | `public (default)` | `public.is_firm_member(firm_id) or public.is_client_owner(client_id) or public.is_platform_admin()` | - | `20261101000020_documents.sql` |
| `documents` | `documents_insert` | **INSERT** | `public (default)` | - | `public.is_firm_member(firm_id) or (public.is_client_owner(client_id) and kind in ('purchase_bill', 'sales_file')) or public.is_platform_admin()` | `20261101000020_documents.sql` |
| `documents` | `documents_update` | **UPDATE** | `public (default)` | `public.is_firm_member(firm_id) or public.is_platform_admin()` | `public.is_firm_member(firm_id) or public.is_platform_admin()` | `20261101000020_documents.sql` |
| `documents` | `documents_delete` | **DELETE** | `public (default)` | `public.is_firm_admin(firm_id) or public.is_platform_admin()` | - | `20261101000020_documents.sql` |
| `suppliers` | `suppliers_select` | **SELECT** | `public (default)` | `public.is_firm_member(firm_id) or public.is_client_owner(client_id) or public.is_platform_admin()` | - | `20261101000030_purchases.sql` |
| `suppliers` | `suppliers_insert` | **INSERT** | `public (default)` | - | `public.is_firm_member(firm_id) or public.is_platform_admin()` | `20261101000030_purchases.sql` |
| `suppliers` | `suppliers_update` | **UPDATE** | `public (default)` | `public.is_firm_member(firm_id) or public.is_platform_admin()` | `public.is_firm_member(firm_id) or public.is_platform_admin()` | `20261101000030_purchases.sql` |
| `suppliers` | `suppliers_delete` | **DELETE** | `public (default)` | `public.is_firm_admin(firm_id) or public.is_platform_admin()` | - | `20261101000030_purchases.sql` |
| `invoices` | `invoices_select` | **SELECT** | `public (default)` | `public.is_firm_member(firm_id) or public.is_client_owner(client_id) or public.is_platform_admin()` | - | `20261101000030_purchases.sql` |
| `invoices` | `invoices_insert` | **INSERT** | `public (default)` | - | `public.is_firm_member(firm_id) or public.is_platform_admin()` | `20261101000030_purchases.sql` |
| `invoices` | `invoices_update` | **UPDATE** | `public (default)` | `public.is_firm_member(firm_id) or public.is_platform_admin()` | `public.is_firm_member(firm_id) or public.is_platform_admin()` | `20261101000030_purchases.sql` |
| `invoices` | `invoices_delete` | **DELETE** | `public (default)` | `public.is_firm_admin(firm_id) or public.is_platform_admin()` | - | `20261101000030_purchases.sql` |
| `invoice_lines` | `invoice_lines_select` | **SELECT** | `public (default)` | `exists ( select 1 from public.invoices inv where inv.id = invoice_lines.invoice_id and ( public.is_firm_member(inv.firm_id) or public.is_client_owner(inv.client_id) or public.is_platform_admin() ) )` | - | `20261101000030_purchases.sql` |
| `invoice_lines` | `invoice_lines_insert` | **INSERT** | `public (default)` | - | `exists ( select 1 from public.invoices inv where inv.id = invoice_lines.invoice_id and ( public.is_firm_member(inv.firm_id) or public.is_platform_admin() ) )` | `20261101000030_purchases.sql` |
| `invoice_lines` | `invoice_lines_update` | **UPDATE** | `public (default)` | `exists ( select 1 from public.invoices inv where inv.id = invoice_lines.invoice_id and ( public.is_firm_member(inv.firm_id) or public.is_platform_admin() ) )` | `exists ( select 1 from public.invoices inv where inv.id = invoice_lines.invoice_id and ( public.is_firm_member(inv.firm_id) or public.is_platform_admin() ) )` | `20261101000030_purchases.sql` |
| `invoice_lines` | `invoice_lines_delete` | **DELETE** | `public (default)` | `exists ( select 1 from public.invoices inv where inv.id = invoice_lines.invoice_id and ( public.is_firm_admin(inv.firm_id) or public.is_platform_admin() ) )` | - | `20261101000030_purchases.sql` |
| `invoice_payments` | `invoice_payments_select` | **SELECT** | `public (default)` | `exists ( select 1 from public.invoices inv where inv.id = invoice_payments.invoice_id and ( public.is_firm_member(inv.firm_id) or public.is_client_owner(inv.client_id) or public.is_platform_admin() ) )` | - | `20261101000030_purchases.sql` |
| `invoice_payments` | `invoice_payments_insert` | **INSERT** | `public (default)` | - | `exists ( select 1 from public.invoices inv where inv.id = invoice_payments.invoice_id and ( public.is_firm_member(inv.firm_id) or public.is_platform_admin() ) )` | `20261101000030_purchases.sql` |
| `invoice_payments` | `invoice_payments_update` | **UPDATE** | `public (default)` | `exists ( select 1 from public.invoices inv where inv.id = invoice_payments.invoice_id and ( public.is_firm_member(inv.firm_id) or public.is_platform_admin() ) )` | `exists ( select 1 from public.invoices inv where inv.id = invoice_payments.invoice_id and ( public.is_firm_member(inv.firm_id) or public.is_platform_admin() ) )` | `20261101000030_purchases.sql` |
| `invoice_payments` | `invoice_payments_delete` | **DELETE** | `public (default)` | `exists ( select 1 from public.invoices inv where inv.id = invoice_payments.invoice_id and ( public.is_firm_admin(inv.firm_id) or public.is_platform_admin() ) )` | - | `20261101000030_purchases.sql` |
| `extraction_fields` | `extraction_fields_select` | **SELECT** | `public (default)` | `exists ( select 1 from public.documents d where d.id = extraction_fields.document_id and ( public.is_firm_member(d.firm_id) or public.is_platform_admin() ) )` | - | `20261101000040_extraction.sql` |
| `extraction_fields` | `extraction_fields_insert` | **INSERT** | `public (default)` | - | `exists ( select 1 from public.documents d where d.id = extraction_fields.document_id and ( public.is_firm_member(d.firm_id) or public.is_platform_admin() ) )` | `20261101000040_extraction.sql` |
| `extraction_fields` | `extraction_fields_update` | **UPDATE** | `public (default)` | `exists ( select 1 from public.documents d where d.id = extraction_fields.document_id and ( public.is_firm_member(d.firm_id) or public.is_platform_admin() ) )` | `exists ( select 1 from public.documents d where d.id = extraction_fields.document_id and ( public.is_firm_member(d.firm_id) or public.is_platform_admin() ) )` | `20261101000040_extraction.sql` |
| `extraction_fields` | `extraction_fields_delete` | **DELETE** | `public (default)` | `exists ( select 1 from public.documents d where d.id = extraction_fields.document_id and ( public.is_firm_admin(d.firm_id) or public.is_platform_admin() ) )` | - | `20261101000040_extraction.sql` |
| `gstr2b_imports` | `gstr2b_imports_select_firm_member` | **SELECT** | `public (default)` | `public.is_firm_member(firm_id) or public.is_platform_admin()` | - | `20261101000050_gstr2b.sql` |
| `gstr2b_imports` | `gstr2b_imports_insert_firm_member` | **INSERT** | `public (default)` | - | `public.is_firm_member(firm_id) or public.is_platform_admin()` | `20261101000050_gstr2b.sql` |
| `gstr2b_imports` | `gstr2b_imports_update_firm_member` | **UPDATE** | `public (default)` | `public.is_firm_member(firm_id) or public.is_platform_admin()` | `public.is_firm_member(firm_id) or public.is_platform_admin()` | `20261101000050_gstr2b.sql` |
| `gstr2b_imports` | `gstr2b_imports_delete_firm_admin` | **DELETE** | `public (default)` | `public.is_firm_admin(firm_id) or public.is_platform_admin()` | - | `20261101000050_gstr2b.sql` |
| `gstr2b_records` | `gstr2b_records_select_import_member` | **SELECT** | `public (default)` | `exists ( select 1 from public.gstr2b_imports imp where imp.id = gstr2b_records.import_id and (public.is_firm_member(imp.firm_id) or public.is_platform_admin()) )` | - | `20261101000050_gstr2b.sql` |
| `gstr2b_records` | `gstr2b_records_insert_import_member` | **INSERT** | `public (default)` | - | `exists ( select 1 from public.gstr2b_imports imp where imp.id = gstr2b_records.import_id and (public.is_firm_member(imp.firm_id) or public.is_platform_admin()) )` | `20261101000050_gstr2b.sql` |
| `gstr2b_records` | `gstr2b_records_update_import_member` | **UPDATE** | `public (default)` | `exists ( select 1 from public.gstr2b_imports imp where imp.id = gstr2b_records.import_id and (public.is_firm_member(imp.firm_id) or public.is_platform_admin()) )` | `exists ( select 1 from public.gstr2b_imports imp where imp.id = gstr2b_records.import_id and (public.is_firm_member(imp.firm_id) or public.is_platform_admin()) )` | `20261101000050_gstr2b.sql` |
| `gstr2b_records` | `gstr2b_records_delete_import_admin` | **DELETE** | `public (default)` | `exists ( select 1 from public.gstr2b_imports imp where imp.id = gstr2b_records.import_id and (public.is_firm_admin(imp.firm_id) or public.is_platform_admin()) )` | - | `20261101000050_gstr2b.sql` |
| `reconciliation_runs` | `reconciliation_runs_select` | **SELECT** | `public (default)` | `public.is_firm_member(firm_id) or public.is_client_owner(client_id) or public.is_platform_admin()` | - | `20261101000060_reconciliation.sql` |
| `reconciliation_runs` | `reconciliation_runs_insert` | **INSERT** | `public (default)` | - | `public.is_firm_member(firm_id) or public.is_platform_admin()` | `20261101000060_reconciliation.sql` |
| `reconciliation_runs` | `reconciliation_runs_update` | **UPDATE** | `public (default)` | `public.is_firm_member(firm_id) or public.is_platform_admin()` | `public.is_firm_member(firm_id) or public.is_platform_admin()` | `20261101000060_reconciliation.sql` |
| `reconciliation_runs` | `reconciliation_runs_delete` | **DELETE** | `public (default)` | `public.is_firm_admin(firm_id) or public.is_platform_admin()` | - | `20261101000060_reconciliation.sql` |
| `reconciliation_results` | `reconciliation_results_select` | **SELECT** | `public (default)` | `exists ( select 1 from public.reconciliation_runs rr where rr.id = run_id and ( public.is_firm_member(rr.firm_id) or public.is_client_owner(rr.client_id) or public.is_platform_admin() ) )` | - | `20261101000060_reconciliation.sql` |
| `reconciliation_results` | `reconciliation_results_insert` | **INSERT** | `public (default)` | - | `exists ( select 1 from public.reconciliation_runs rr where rr.id = run_id and ( public.is_firm_member(rr.firm_id) or public.is_platform_admin() ) )` | `20261101000060_reconciliation.sql` |
| `reconciliation_results` | `reconciliation_results_update` | **UPDATE** | `public (default)` | `exists ( select 1 from public.reconciliation_runs rr where rr.id = run_id and ( public.is_firm_member(rr.firm_id) or public.is_platform_admin() ) )` | `exists ( select 1 from public.reconciliation_runs rr where rr.id = run_id and ( public.is_firm_member(rr.firm_id) or public.is_platform_admin() ) )` | `20261101000060_reconciliation.sql` |
| `reconciliation_results` | `reconciliation_results_delete` | **DELETE** | `public (default)` | `exists ( select 1 from public.reconciliation_runs rr where rr.id = run_id and ( public.is_firm_admin(rr.firm_id) or public.is_platform_admin() ) )` | - | `20261101000060_reconciliation.sql` |
| `sales_entries` | `sales_entries_select` | **SELECT** | `public (default)` | `public.is_firm_member(firm_id) or public.is_client_owner(client_id) or public.is_platform_admin()` | - | `20261101000070_sales_returns.sql` |
| `sales_entries` | `sales_entries_insert` | **INSERT** | `public (default)` | - | `public.is_firm_member(firm_id) or public.is_client_owner(client_id) or public.is_platform_admin()` | `20261101000070_sales_returns.sql` |
| `sales_entries` | `sales_entries_update` | **UPDATE** | `public (default)` | `public.is_firm_member(firm_id) or public.is_client_owner(client_id) or public.is_platform_admin()` | `public.is_firm_member(firm_id) or public.is_client_owner(client_id) or public.is_platform_admin()` | `20261101000070_sales_returns.sql` |
| `sales_entries` | `sales_entries_delete` | **DELETE** | `public (default)` | `public.is_firm_admin(firm_id) or public.is_platform_admin()` | - | `20261101000070_sales_returns.sql` |
| `sales_invoices` | `sales_invoices_select` | **SELECT** | `public (default)` | `public.is_firm_member(firm_id) or public.is_client_owner(client_id) or public.is_platform_admin()` | - | `20261101000070_sales_returns.sql` |
| `sales_invoices` | `sales_invoices_insert` | **INSERT** | `public (default)` | - | `public.is_firm_member(firm_id) or public.is_platform_admin()` | `20261101000070_sales_returns.sql` |
| `sales_invoices` | `sales_invoices_update` | **UPDATE** | `public (default)` | `public.is_firm_member(firm_id) or public.is_platform_admin()` | `public.is_firm_member(firm_id) or public.is_platform_admin()` | `20261101000070_sales_returns.sql` |
| `sales_invoices` | `sales_invoices_delete` | **DELETE** | `public (default)` | `public.is_firm_admin(firm_id) or public.is_platform_admin()` | - | `20261101000070_sales_returns.sql` |
| `return_periods` | `return_periods_select` | **SELECT** | `public (default)` | `public.is_firm_member(firm_id) or public.is_client_owner(client_id) or public.is_platform_admin()` | - | `20261101000070_sales_returns.sql` |
| `return_periods` | `return_periods_insert` | **INSERT** | `public (default)` | - | `public.is_firm_member(firm_id) or public.is_platform_admin()` | `20261101000070_sales_returns.sql` |
| `return_periods` | `return_periods_update` | **UPDATE** | `public (default)` | `public.is_firm_member(firm_id) or public.is_platform_admin()` | `public.is_firm_member(firm_id) or public.is_platform_admin()` | `20261101000070_sales_returns.sql` |
| `return_periods` | `return_periods_delete` | **DELETE** | `public (default)` | `public.is_firm_admin(firm_id) or public.is_platform_admin()` | - | `20261101000070_sales_returns.sql` |
| `return_drafts` | `return_drafts_select` | **SELECT** | `public (default)` | `exists ( select 1 from public.return_periods rp where rp.id = return_drafts.return_period_id and ( public.is_firm_member(rp.firm_id) or public.is_client_owner(rp.client_id) or public.is_platform_admin() ) )` | - | `20261101000070_sales_returns.sql` |
| `return_drafts` | `return_drafts_insert` | **INSERT** | `public (default)` | - | `exists ( select 1 from public.return_periods rp where rp.id = return_drafts.return_period_id and ( public.is_firm_member(rp.firm_id) or public.is_platform_admin() ) )` | `20261101000070_sales_returns.sql` |
| `return_drafts` | `return_drafts_update` | **UPDATE** | `public (default)` | `exists ( select 1 from public.return_periods rp where rp.id = return_drafts.return_period_id and ( public.is_firm_member(rp.firm_id) or public.is_platform_admin() ) )` | `exists ( select 1 from public.return_periods rp where rp.id = return_drafts.return_period_id and ( public.is_firm_member(rp.firm_id) or public.is_platform_admin() ) )` | `20261101000070_sales_returns.sql` |
| `return_drafts` | `return_drafts_delete` | **DELETE** | `public (default)` | `exists ( select 1 from public.return_periods rp where rp.id = return_drafts.return_period_id and ( public.is_firm_admin(rp.firm_id) or public.is_platform_admin() ) )` | - | `20261101000070_sales_returns.sql` |
| `rule_snapshots` | `rule_snapshots_select` | **SELECT** | `public (default)` | `auth.role() = 'authenticated'` | - | `20261101000080_rules.sql` |
| `rule_snapshots` | `rule_snapshots_insert` | **INSERT** | `public (default)` | - | `public.is_platform_admin()` | `20261101000080_rules.sql` |
| `gst_rate_rules` | `gst_rate_rules_select` | **SELECT** | `public (default)` | `auth.role() = 'authenticated'` | - | `20261101000080_rules.sql` |
| `gst_rate_rules` | `gst_rate_rules_insert` | **INSERT** | `public (default)` | - | `public.is_platform_admin()` | `20261101000080_rules.sql` |
| `gst_rate_rules` | `gst_rate_rules_update` | **UPDATE** | `public (default)` | `public.is_platform_admin()` | `public.is_platform_admin()` | `20261101000080_rules.sql` |
| `gst_rate_rules` | `gst_rate_rules_delete` | **DELETE** | `public (default)` | `public.is_platform_admin()` | - | `20261101000080_rules.sql` |
| `rule_params` | `rule_params_select` | **SELECT** | `public (default)` | `auth.role() = 'authenticated'` | - | `20261101000080_rules.sql` |
| `rule_params` | `rule_params_insert` | **INSERT** | `public (default)` | - | `public.is_platform_admin()` | `20261101000080_rules.sql` |
| `rule_params` | `rule_params_update` | **UPDATE** | `public (default)` | `public.is_platform_admin()` | `public.is_platform_admin()` | `20261101000080_rules.sql` |
| `rule_params` | `rule_params_delete` | **DELETE** | `public (default)` | `public.is_platform_admin()` | - | `20261101000080_rules.sql` |
| `audit_events` | `audit_events_select` | **SELECT** | `public (default)` | `public.is_firm_admin(firm_id) or public.is_platform_admin()` | - | `20261101000090_audit_alerts.sql` |
| `audit_events` | `audit_events_insert` | **INSERT** | `public (default)` | - | `auth.role() = 'service_role' or ( auth.uid() is not null and (actor_id is null or actor_id = auth.uid()) and (public.is_firm_member(firm_id) or public.is_platform_admin()) ) or public.is_firm_admin(firm_id) or public.is_platform_admin()` | `20261101000090_audit_alerts.sql` |
| `alerts` | `alerts_select` | **SELECT** | `public (default)` | `public.is_firm_member(firm_id) or (client_id is not null and public.is_client_owner(client_id)) or public.is_platform_admin()` | - | `20261101000090_audit_alerts.sql` |
| `alerts` | `alerts_insert` | **INSERT** | `public (default)` | - | `public.is_firm_member(firm_id) or public.is_platform_admin()` | `20261101000090_audit_alerts.sql` |
| `alerts` | `alerts_update` | **UPDATE** | `public (default)` | `public.is_firm_member(firm_id) or public.is_platform_admin()` | `public.is_firm_member(firm_id) or public.is_platform_admin()` | `20261101000090_audit_alerts.sql` |
| `alerts` | `alerts_delete` | **DELETE** | `public (default)` | `public.is_firm_admin(firm_id) or public.is_platform_admin()` | - | `20261101000090_audit_alerts.sql` |
| `client_invites` | `client_invites_select` | **SELECT** | `authenticated` | `public.is_firm_admin(firm_id) or public.is_platform_admin()` | - | `20261101000100_invites.sql` |
| `client_invites` | `client_invites_insert` | **INSERT** | `authenticated` | - | `public.is_firm_admin(firm_id) or public.is_platform_admin()` | `20261101000100_invites.sql` |
| `client_invites` | `client_invites_update` | **UPDATE** | `authenticated` | `public.is_firm_admin(firm_id) or public.is_platform_admin()` | `public.is_firm_admin(firm_id) or public.is_platform_admin()` | `20261101000100_invites.sql` |
| `client_invites` | `client_invites_delete` | **DELETE** | `authenticated` | `public.is_firm_admin(firm_id) or public.is_platform_admin()` | - | `20261101000100_invites.sql` |
| `client_invites` | `client_invites_delete` | **DELETE** | `authenticated` | `(public.is_firm_admin(firm_id) or public.is_platform_admin()) and accepted_at is null` | - | `20261101000110_client_support.sql` |
| `client_invites` | `client_invites_update` | **UPDATE** | `authenticated` | `(public.is_firm_admin(firm_id) or public.is_platform_admin()) and accepted_at is null` | `(public.is_firm_admin(firm_id) or public.is_platform_admin()) and accepted_at is null` | `20261101000110_client_support.sql` |

### 5.3 Storage Object RLS Policies (Storage Bucket: `documents`)

Migration `20261101000020_documents.sql` provisions the private `documents` storage bucket in Supabase Storage (`storage.buckets`) and configures 4 isolation policies on `storage.objects`:

| Policy Name | Command | Role | Security Logic / Path Enforcement |
|---|---|---|---|
| `documents_storage_select` | **SELECT** | `public` | Allows read if platform admin, OR if object name matches regex `^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/` and user is either a member of the folder's `firm_id` (folder 1) OR owner of the folder's `client_id` (folder 2). |
| `documents_storage_insert` | **INSERT** | `public` | With check enforcing matching firm membership or client ownership within the folder path structure `{firm_id}/{client_id}/{filename}`. |
| `documents_storage_update` | **UPDATE** | `public` | Scoped to platform admins or firm members belonging to the top-level folder's firm UUID (`^[0-9a-fA-F-]{36}/`). |
| `documents_storage_delete` | **DELETE** | `public` | Restricted strictly to platform admins or CA firm admins (`is_firm_admin`) of the root firm UUID. |

### 5.4 Immutability & Append-Only Guarantees

Two tables implement statutory append-only guarantees where `UPDATE` and `DELETE` are strictly prevented:

1. **`public.audit_events`:**
   - Has `SELECT` policy (`audit_events_select`) for firm admins and platform admins.
   - Has `INSERT` policy (`audit_events_insert`) for system service_role and authenticated members.
   - **NO UPDATE or DELETE policies exist.** Any modification attempt is denied by RLS.
   - Guarded by trigger `trg_audit_no_update_delete` executing `prevent_audit_modification()`, which raises an unhandled PostgreSQL exception on any `UPDATE` or `DELETE` statement.
2. **`public.rule_snapshots`:**
   - Has `SELECT` policy (`rule_snapshots_select`) for all authenticated users.
   - Has `INSERT` policy (`rule_snapshots_insert`) restricted to platform admins.
   - **NO UPDATE or DELETE policies exist**, guaranteeing that statutory checksum snapshots are permanent.

---

## 6. Stored Functions, RPCs, and Triggers

### 6.1 PL/pgSQL Functions Catalog

The database defines **17 functions**, all configured with `security definer` (or trigger) and hardened with explicit `set search_path = ''` to neutralize search path injection vulnerabilities:

| Function Name | Return Type | Security Mode | Hardened Search Path | Purpose / Operational Mechanics | Migration |
|---|---|---|---|---|---|
| `set_updated_at()` | `trigger` | Invoker | `set search_path = ''` | Updates `NEW.updated_at = clock_timestamp()` before row update. | `000_base.sql` |
| `is_firm_member(firm uuid)` | `boolean` | Definier | `set search_path = ''` | Checks if `auth.uid()` is present in `firm_members` for given firm. | `000_base.sql` |
| `is_firm_admin(firm uuid)` | `boolean` | Definier | `set search_path = ''` | Checks if `auth.uid()` is present in `firm_members` with `role = 'admin'`. | `000_base.sql` |
| `has_client_access(client uuid)` | `boolean` | Definier | `set search_path = ''` | Checks if user is member of client's firm OR has direct `client_access` grant. | `000_base.sql` |
| `is_client_owner(client uuid)` | `boolean` | Definier | `set search_path = ''` | Checks if user is assigned `owner` role in `client_access` for this client. | `000_base.sql` |
| `is_platform_admin()` | `boolean` | Definier | `set search_path = ''` | Checks if `auth.uid()` exists in `platform_admins` table. | `000_base.sql` |
| `prevent_audit_modification()` | `trigger` | Definier | `set search_path = ''` | Rejects any `UPDATE` or `DELETE` on `audit_events` by raising an exception. | `090_audit_alerts.sql` |
| `audit_entity_change()` | `trigger` | Definier | `set search_path = ''` | Generic trigger recording `INSERT`, `UPDATE`, and `DELETE` diffs into `audit_events`. | `090_audit_alerts.sql` |
| `create_firm_with_admin(firm_name text)` | `uuid` | Definier | `set search_path = ''` | Transactionally creates a firm and binds `auth.uid()` as its founding admin. | `100_invites.sql` |
| `create_client_invite(p_client_id uuid)` | `text` | Definier | `set search_path = ''` | Generates a 32-byte cryptographically secure token, hashes it with SHA-256, and stores invite. | `100_invites.sql` |
| `peek_client_invite(p_token text)` | `jsonb` | Definier | `set search_path = ''` | Unauthenticated verification RPC returning client name, firm name, and expiration. | `100_invites.sql` |
| `accept_client_invite(p_token text)` | `uuid` | Definier | `set search_path = ''` | Atomically claims token, assigns `owner` role in `client_access`, and marks invite accepted. | `100_invites.sql` |
| `check_client_archive_permission()` | `trigger` | Definier | `set search_path = ''` | Prevents non-firm-admins from setting or un-setting `clients.deleted_at`. | `110_client_support.sql` |
| `check_upload_quota(client_id_param uuid, n int)` | `boolean` | Definier | `set search_path = ''` | Enforces rate limit of 100 uploads per hour per client organization. | `120_uploads.sql` |
| `cleanup_stale_uploads(client_id_param uuid)` | `integer` | Definier | `set search_path = ''` | Soft-deletes unconfirmed documents remaining in `uploaded` status > 1 hour. | `120_uploads.sql` |
| `confirm_document_upload(document_id_param uuid)` | `jsonb` | Definier | `set search_path = ''` | Verifies storage object presence in bucket and transitions document to `queued`. | `120_uploads.sql` |
| `fail_document_upload(document_id_param uuid, reason text)` | `jsonb` | Definier | `set search_path = ''` | Transitions document status to `failed` with audit failure description. | `120_uploads.sql` |

### 6.2 Database Triggers Catalog

The schema attaches **28 triggers** across 20 tables:

| Target Table | Trigger Name | Timing | Event | Executed Function | Migration |
|---|---|---|---|---|---|
| `firms` | `set_firms_updated_at` | BEFORE | UPDATE | `set_updated_at()` | `010_tenancy.sql` |
| `firm_members` | `set_firm_members_updated_at` | BEFORE | UPDATE | `set_updated_at()` | `010_tenancy.sql` |
| `clients` | `set_clients_updated_at` | BEFORE | UPDATE | `set_updated_at()` | `010_tenancy.sql` |
| `clients` | `trg_audit_clients` | AFTER | INSERT OR UPDATE OR DELETE | `audit_entity_change()` | `090_audit_alerts.sql` |
| `clients` | `trg_check_client_archive_permission` | BEFORE | UPDATE | `check_client_archive_permission()` | `110_client_support.sql` |
| `client_access` | `set_client_access_updated_at` | BEFORE | UPDATE | `set_updated_at()` | `010_tenancy.sql` |
| `documents` | `set_documents_updated_at` | BEFORE | UPDATE | `set_updated_at()` | `020_documents.sql` |
| `suppliers` | `set_suppliers_updated_at` | BEFORE | UPDATE | `set_updated_at()` | `030_purchases.sql` |
| `invoices` | `set_invoices_updated_at` | BEFORE | UPDATE | `set_updated_at()` | `030_purchases.sql` |
| `invoices` | `trg_audit_invoices` | AFTER | INSERT OR UPDATE OR DELETE | `audit_entity_change()` | `090_audit_alerts.sql` |
| `invoice_lines` | `set_invoice_lines_updated_at` | BEFORE | UPDATE | `set_updated_at()` | `030_purchases.sql` |
| `invoice_payments` | `set_invoice_payments_updated_at` | BEFORE | UPDATE | `set_updated_at()` | `030_purchases.sql` |
| `extraction_fields` | `set_extraction_fields_updated_at` | BEFORE | UPDATE | `set_updated_at()` | `040_extraction.sql` |
| `gstr2b_imports` | `trg_gstr2b_imports_set_updated_at` | BEFORE | UPDATE | `set_updated_at()` | `050_gstr2b.sql` |
| `gstr2b_records` | `trg_gstr2b_records_set_updated_at` | BEFORE | UPDATE | `set_updated_at()` | `050_gstr2b.sql` |
| `reconciliation_runs` | `trg_reconciliation_runs_set_updated_at` | BEFORE | UPDATE | `set_updated_at()` | `060_reconciliation.sql` |
| `reconciliation_results` | `trg_reconciliation_results_set_updated_at` | BEFORE | UPDATE | `set_updated_at()` | `060_reconciliation.sql` |
| `reconciliation_results` | `trg_audit_reconciliation_results` | AFTER | INSERT OR UPDATE OR DELETE | `audit_entity_change()` | `090_audit_alerts.sql` |
| `sales_entries` | `set_sales_entries_updated_at` | BEFORE | UPDATE | `set_updated_at()` | `070_sales_returns.sql` |
| `sales_invoices` | `set_sales_invoices_updated_at` | BEFORE | UPDATE | `set_updated_at()` | `070_sales_returns.sql` |
| `return_periods` | `set_return_periods_updated_at` | BEFORE | UPDATE | `set_updated_at()` | `070_sales_returns.sql` |
| `return_drafts` | `set_return_drafts_updated_at` | BEFORE | UPDATE | `set_updated_at()` | `070_sales_returns.sql` |
| `return_drafts` | `trg_audit_return_drafts` | AFTER | INSERT OR UPDATE OR DELETE | `audit_entity_change()` | `090_audit_alerts.sql` |
| `gst_rate_rules` | `set_gst_rate_rules_updated_at` | BEFORE | UPDATE | `set_updated_at()` | `080_rules.sql` |
| `rule_params` | `set_rule_params_updated_at` | BEFORE | UPDATE | `set_updated_at()` | `080_rules.sql` |
| `audit_events` | `trg_audit_no_update_delete` | BEFORE | UPDATE OR DELETE | `prevent_audit_modification()` | `090_audit_alerts.sql` |
| `alerts` | `set_alerts_updated_at` | BEFORE | UPDATE | `set_updated_at()` | `090_audit_alerts.sql` |
| `client_invites` | `set_client_invites_updated_at` | BEFORE | UPDATE | `set_updated_at()` | `100_invites.sql` |

---

## 7. PostgreSQL Custom ENUM Types

Defined in `20261101000000_base.sql`, the schema provides **24 strongly-typed custom enums**:

| Enum Name | Allowed Values | Target Domain Columns |
|---|---|---|
| `firm_role` | `admin`, `staff` | `firm_members.role` |
| `client_role` | `owner`, `staff` | `client_access.role` |
| `scheme` | `regular`, `qrmp`, `composition`, `unregistered` | `clients.scheme` |
| `aato_band` | `below_40l`, `40l_to_1_5cr`, `1_5cr_to_5cr`, `above_5cr` | `clients.aato_band` |
| `lang` | `en`, `hi`, `mr` | `clients.language` |
| `doc_kind` | `purchase_bill`, `gstr2b_file`, `sales_file`, `bank_file`, `other` | `documents.kind` |
| `doc_status` | `uploaded`, `queued`, `processing`, `needs_review`, `done`, `failed` | `documents.status` |
| `inv_status` | `draft`, `needs_review`, `approved`, `rejected` | `invoices.status`, `sales_invoices.status` |
| `inv_source` | `extracted`, `manual`, `imported` | `invoices.source` |
| `itc_state` | `eligible`, `ineligible`, `blocked`, `pending` | `invoices.itc_state` |
| `filing_status` | `unknown`, `filed`, `not_filed`, `cancelled` | `suppliers.filing_status` |
| `pay_mode` | `cash`, `upi`, `bank`, `other` | `invoice_payments.mode` |
| `rate_status` | `ok`, `mismatch`, `unknown` | `invoice_lines.rate_status` |
| `gstr2b_section` | `b2b`, `b2ba`, `cdnr`, `cdnra` | `gstr2b_records.section` |
| `ims_action` | `none`, `accepted`, `rejected`, `pending` | `gstr2b_records.ims_action` |
| `recon_status` | `matched`, `fuzzy_match`, `period_shift`, `missing_in_2b`, `missing_in_books`, `mismatch` | `reconciliation_results.status` |
| `user_decision` | `none`, `accepted`, `disputed`, `ignored` | `reconciliation_results.user_decision` |
| `sales_source` | `manual`, `csv`, `upi_statement` | `sales_entries.source` |
| `sales_doc_type` | `tax_invoice`, `bill_of_supply`, `invoice_cum_bos`, `credit_note`, `debit_note` | `sales_invoices.doc_type` |
| `return_type` | `gstr1`, `gstr3b`, `cmp08`, `gstr4` | `return_periods.return_type` |
| `return_status` | `not_started`, `draft`, `in_review`, `approved`, `filed` | `return_periods.status` |
| `alert_kind` | `deadline`, `itc_at_risk`, `threshold`, `missing_docs`, `rule_change`, `late_fee` | `alerts.kind` |
| `severity` | `info`, `warn`, `urgent` | `alerts.severity` |
| `alert_status` | `open`, `dismissed`, `done` | `alerts.status` |

---

## 8. Architectural Strengths, Gaps, and Recommendations

### 8.1 Key Architectural Strengths

1. **Denormalized Tenant Isolation ($O(1)$ RLS):** Denormalizing `firm_id` on tables such as `documents`, `invoices`, `sales_entries`, `return_periods`, and `alerts` avoids recursive multi-table joins during policy checks, resulting in optimal query performance and preventing cross-tenant leakage.
2. **Defensive Function Execution:** Every custom function includes an explicit `set search_path = ''` pragma, protecting the security definer functions against schema hijacking or malicious `search_path` override attacks.
3. **Statutory Immutability:** `audit_events` implements append-only compliance (CGST Act Sections 35 & 36) enforced at both the RLS policy layer (absence of update/delete policies) and PostgreSQL trigger layer (`prevent_audit_modification`).
4. **100% Schema & Domain Parity:** Verified that all 25 public tables in the database schema have direct corresponding TypeScript models and Zod validation schemas in `src/lib/domain/`.

### 8.2 Architectural Gaps & Statutory Recommendations

1. **Docker Environment Prerequisite:** To run `npm run db:reset` and `npm run db:test`, Docker Desktop or a Linux Docker engine must be installed and active on the host machine.
2. **pgTAP Test Suite Compound Join Masking:** As documented in previous QA audits, tests 14 and 16 in `rls_recon_sales_returns_alerts.test.sql` rely on inner joins that can pass vacuously if the parent table returns 0 rows. Assertions should test child rows by primary key without parent joins.
3. **Outward HSN Line Item Table:** `invoice_lines` handles inward purchase line items. For outward supply filings (GSTR-1 Table 12 HSN summary), an equivalent `sales_invoice_lines` table should be provisioned to capture HSN, unit quantity codes (UQC), quantities, and rate breakdowns for sales.
4. **IMS Action Timestamps:** `gstr2b_records` includes `ims_action` and `ims_action_at`, allowing the reconciliation engine to determine whether recipient actions occurred before or after the 14th cutoff date.

---

**Report Certification:**  
*Audited and generated by Lane D (Read-Only Project Auditor).*  
*Strict read-only compliance maintained; zero application files modified outside `docs/qa/audit-db.md`.*
