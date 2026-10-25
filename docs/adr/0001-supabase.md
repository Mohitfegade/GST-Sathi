# Architecture Decision Record (ADR) 0001: Selection of Supabase Postgres & RLS for Multi-Tenant GST Compliance

## Metadata
- **Status**: Accepted
- **Deciders**: Technical Architecture Team, Lead Compliance Architect, Database Engineering Lead
- **Date**: October 2026
- **Technical Domains**: Database Architecture, Security & Access Control, Statutory Regulatory Compliance, Multi-Tenancy

---

## 1. Context and Problem Statement

### 1.1 The Multi-Tenant Reality of Indian GST Practice
In India, the majority of Micro, Small, and Medium Enterprises (MSMEs)—such as neighbourhood kirana stores, stationery shops, hardware dealers, and retail pharmacies—do not prepare their own Goods and Services Tax (GST) returns. Instead, they retain Chartered Accountants (CAs), Tax Return Preparers (TRPs), or independent tax advocates who manage tax compliance for portfolios ranging from 20 to over 150 client businesses simultaneously.

This creates an asymmetric, multi-tier operational dynamic:
1. **The Accounting Firm (Primary Tenant)**: Employs partners and staff accountants who require a consolidated, high-throughput desktop cockpit to review and reconcile transactions across all client GSTINs in their portfolio.
2. **The Client SME (Secondary Tenant / Sub-Tenant)**: Requires an ultra-simple, mobile-friendly interface to upload purchase bills, enter daily sales summaries, check filing statuses, and download tax challans (PMT-06) without seeing internal CA notes, other clients' records, or tax engine complexities.

### 1.2 Legal and Regulatory Mandates
Multi-tenancy in financial and tax software operates under stringent legal liability in India:
- **Digital Personal Data Protection (DPDP) Act, 2023**: As a Data Fiduciary and Processor of sensitive financial records, the platform faces statutory fines of up to ₹250 Crores under Section 33 for failing to implement reasonable security safeguards to prevent personal or business data breaches. Cross-tenant leakage of proprietary purchase invoices, customer lists, or margin data represents a catastrophic regulatory violation.
- **CGST Act, 2017 (Sections 35 & 36, Rule 56)**: Mandates the maintenance of true, complete, and unalterable accounts of inward and outward supplies for at least 72 months (6 years) from the due date of furnishing the annual return. Audit trails must be tamper-proof and attributable to specific actors.
- **Data Residency Guidelines**: Indian financial, tax, and banking data should reside within national borders to satisfy compliance and audit expectations from Indian regulators.

### 1.3 The Failure Mode of Application-Layer Multi-Tenancy
Traditional software architectures often rely on application-level filtering (e.g. `SELECT * FROM invoices WHERE firm_id = ? AND client_id = ?` injected by an ORM or service layer). In fast-moving development teams, this approach exhibits well-known failure modes:
1. **Omitted Where-Clauses**: A developer building an export routine, reporting query, or background cron worker forgets to append `client_id` or `firm_id`, exposing all tenant records.
2. **Complex Joins & Aggregations**: Relational joins that bridge multiple sub-entities frequently omit tenant predicates on child tables, leaking related rows.
3. **ORM Bypass / Direct SQL**: Raw SQL queries written for analytics or batch processing inadvertently bypass application middleware filters.

We must select a database and access control architecture that enforces multi-tenancy at the **database engine level**, rendering application-layer leaks impossible.

---

## 2. Decision

We decide to adopt **Supabase PostgreSQL hosted in the AWS Mumbai region (`ap-south-1`)** as our foundational data store, configured with:

1. **Declarative PostgreSQL Row-Level Security (RLS)**:
   - RLS is enabled across all tables in the `public` schema (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`).
   - Default deny policy: Any query or mutation that does not match an explicit permissive policy is blocked by the database kernel.
   - Authentication context is derived directly from cryptographically signed JWTs through `auth.uid()`.

2. **Denormalised `firm_id` on High-Volume Transactional Tables**:
   - High-throughput tables (`documents`, `invoices`, `suppliers`, `audit_events`, `alerts`) maintain a direct, indexed `firm_id` foreign key alongside `client_id`.
   - This eliminates recursive, multi-table relational joins (`invoices -> clients -> firms`) during RLS policy evaluation, keeping per-query latency negligible.

3. **Optimised `SECURITY DEFINER` Access Helper Functions**:
   - Access control evaluation is centralized in dedicated, hardened helper functions:
     - `is_firm_member(firm uuid) -> boolean`
     - `is_firm_admin(firm uuid) -> boolean`
     - `has_client_access(client uuid) -> boolean`
     - `is_client_owner(client uuid) -> boolean`
     - `is_platform_admin() -> boolean`
   - Every function is declared with `SET search_path = ''` to prevent search path hijacking.
   - Functions are declared `STABLE` to allow the PostgreSQL query planner to cache function results within the scope of a single query execution.

4. **Append-Only, Tamper-Proof Audit Ledger (`audit_events`)**:
   - A dedicated audit table captures actor ID, entity name, entity ID, action, before/after JSON states, and timestamps.
   - RLS policies and a database-level trigger (`BEFORE UPDATE OR DELETE`) strictly prohibit any update or delete operations on this table, fulfilling statutory record retention requirements under the CGST Act and DPDP Act.

5. **Integrated Storage RLS**:
   - Unstructured assets (scanned bills, transport biltis, GSTR-2B JSON files) stored in Supabase Storage (`storage.objects`) follow a structured path convention:
     ```
     documents/{firm_id}/{client_id}/{document_id}/{filename}
     ```
   - Storage RLS policies parse the path tokens and invoke the database helper functions (`has_client_access`, `is_firm_member`, `is_firm_admin`), ensuring unified authorization across both relational data and binary document storage.

6. **Local Sovereign Hosting**:
   - The Supabase instance is provisioned exclusively in the **Mumbai region (`ap-south-1`)**, satisfying Indian data localization requirements.

---

## 3. Consequences

### 3.1 Positive Consequences

1. **Hardware- and Engine-Level Tenant Isolation**:
   - Cross-firm and cross-client data leakage is physically prevented by the PostgreSQL kernel. Even if a backend API route has a bug or an engineer runs an unbounded `SELECT * FROM invoices`, only rows belonging to the authenticated tenant are visible.
   
2. **First-Class Support for Asymmetric Multi-Role Workflows**:
   - The dual personas—Accountant Cockpit (managing dozens of clients) and Shop Owner Mobile PWA (restricted to single-business bill upload and summary view)—share the exact same database tables and APIs without risk of data cross-contamination.
   - A shop owner authenticated via magic link or client token can only access their specific `client_id`, while the CA firm staff automatically sees all clients mapped under the firm's portfolio.

3. **DPDP Act & Statutory Audit Compliance**:
   - The immutable `audit_events` ledger provides verifiable forensic evidence for CA sign-offs, tax discrepancy overrides, and data access requests.
   - Data stored in Mumbai complies with domestic regulatory standards.

4. **Unified Authorization for Storage and Real-time Events**:
   - By structuring document paths to match database tenant keys, file access and real-time WebSocket change-data-capture (CDC) notifications obey identical security rules without maintaining a separate authorization service.

### 3.2 Trade-offs and Mitigations

| Trade-off / Risk | Impact | Architectural Mitigation |
|---|---|---|
| **RLS Query Overhead** | Evaluating RLS predicates on every scanned row can cause sequential table scans if joins or subqueries are unindexed. | 1. Direct composite indexes on `(firm_id, user_id)` and `(client_id, user_id)`.<br>2. Denormalisation of `firm_id` to eliminate multi-hop joins in RLS policies.<br>3. Marking helper functions as `STABLE` to enable per-statement query plan caching. |
| **Data Redundancy (Denormalisation)** | Storing `firm_id` on child tables introduces the theoretical risk of firm-client key drift. | 1. Foreign key constraints linking `(id, firm_id)` to the `clients` table.<br>2. Database-level trigger on INSERT/UPDATE verifying that `NEW.firm_id = clients.firm_id`. |
| **Migration & Regression Risk** | A poorly written schema migration could accidentally drop RLS or grant unintended public privileges. | 1. Mandatory **pgTAP** automated test suite run in CI/CD pipeline on every database migration.<br>2. Explicit verification that all 6 roles (Firm Admin, Firm Staff, Client Owner, Client Staff, Authenticated Outsider, Platform Admin) are tested against each table. |
| **Supabase Vendor Lock-in Mitigation** | Relies on Supabase-specific extensions (`auth.uid()`, `storage.objects`). | 1. `auth.uid()` translates to standard `current_setting('request.jwt.claim.sub', true)::uuid` in vanilla PostgreSQL.<br>2. All schema, functions, triggers, and policies are written in standard ANSI SQL / PL/pgSQL, allowing seamless migration to self-hosted PostgreSQL or AWS RDS with PostgREST if necessary. |

---

## 4. Alternatives Considered

### Alternative A: Schema-per-Tenant or Database-per-Tenant
- *Description*: Provisioning a distinct PostgreSQL schema or database instance for each accounting firm.
- *Why Rejected*: CAs frequently manage 50 to 100+ clients, and our platform aims to support thousands of firms. Running thousands of isolated schemas creates severe schema migration bottlenecks, connection pool exhaustion, and prevents cross-client benchmarking (e.g. cross-referencing supplier compliance scores across multiple buyers in the same trading hub).

### Alternative B: Pure Application-Layer Middleware Tenancy
- *Description*: Enforcing multi-tenancy exclusively via Next.js backend middleware / Prisma / Drizzle ORM query filters without database RLS.
- *Why Rejected*: High risk of developer error, accidental data leaks through unconstrained joins or background jobs, and incompatibility with direct client-side storage uploads and real-time subscriptions. The DPDP Act's severe penalties mandate cryptographic or database engine-level isolation.

---

## 5. References and Related Documents
- [docs/RLS.md](../RLS.md): Detailed Row-Level Security Matrix, Helper Functions, and Storage Policies.
- [docs/DATA_MODEL.contract.md](../DATA_MODEL.contract.md): Core PostgreSQL Schema & Data Contract.
- [docs/DECISIONS.md](../DECISIONS.md): Product Decisions Log (ADR-001 Accountant-First Workflow).
- **Central Goods and Services Tax Act, 2017**: Sections 35 & 36; Rule 56.
- **Digital Personal Data Protection Act, 2023**: Section 8 & Section 33.
