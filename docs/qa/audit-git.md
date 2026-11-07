# Lane B Audit Report: Git State, Repository Integrity & Secrets Hygiene

**Audit Target:** GST Saathi (`C:\Users\aksha\Downloads\GST-Sathi-main\GST-Sathi-main`)  
**Audit Role:** Lane B (Git State, Secrets Hygiene & Repository Integrity Auditor)  
**Execution Timestamp:** 2026-11-07T06:50:00Z  
**Target Repository Origin:** `https://github.com/Mohitfegade/GST-Sathi.git`  
**Overall Verdict:** **UNVERSIONED ARCHIVE EXTRACT / SECRETS HARDENED / GITIGNORE COMPLIANT**

---

## 1. Executive Summary

A comprehensive repository, Git status, and secrets hygiene audit was performed on the GST Saathi project directory.

### Key Audit Findings:
1. **Unversioned Archive Extract:** The directory is **not** currently an active Git repository. Running `git status`, `git log`, `git branch`, or `git remote -v` fails with `fatal: not a git repository (or any of the parent directories): .git`. Inspection confirmed no `.git` directory exists in the project root or parent folders. The directory structure (`Downloads\GST-Sathi-main\GST-Sathi-main`) is an unversioned archive extract (such as a GitHub branch ZIP download or clean archive export).
2. **Historical Git Context Preserved:** Archival records in `docs/qa/agent1-secrets-audit.md` and `docs/qa/agent2-remote-sync.md` document that this codebase originated from `https://github.com/Mohitfegade/GST-Sathi.git` on branch `main`, with remote merge base `5e206d9` and local HEAD commit `51e33e6` (`fix(next16): remove blocking Date.now() during prerender`).
3. **Zero Real Customer Bills or Private Datasets:** All bill files in `supabase/fixtures/bills/` (`fake_invoice_1.png`, `fake_invoice_2.jpg`, `fake_invoice_3.pdf`) are 100% synthetic fixtures generated programmatically by `scripts/generate-fake-bills.mjs`. All mock databases (`clients.fake.json`, `fake-dev-users.json`, `fake-tenants.json`) contain explicitly synthetic identities (`FAKE - ...`, `27FAKES1234A1ZJ`, `@fake-test.local`). No real GSTINs, personal taxpayer PII, or real customer invoices exist anywhere. No `eval/private` folders or private test sets exist.
4. **Secrets & Credentials Hygiene:**
   - `.env.example` contains only safe placeholder values and local loopback URLs (`http://127.0.0.1:54321`, `http://localhost:3000`).
   - `.env.local` is present in the local filesystem. It contains local development configuration and an active Vercel CLI session token (`VERCEL_OIDC_TOKEN`, issued 2026-11-06T17:59:32Z, expired 2026-11-07T05:59:32Z).
   - Crucially, `.env.local` is **strictly ignored** by `.gitignore` rules (`.env.*`, `.env*.local`, `.env*`).
   - No private key files (`.pem`, `.key`, `.cert`, `.pfx`, `.p12`, `id_rsa`) exist in the repository.
   - Developer scripts (`dev-upload.mjs`, `dev-invite.mjs`, `seed-clients.mjs`, `smoke-test.mjs`) use standard, well-documented Supabase local Docker demo keys (`iss: "supabase-demo"`), which are non-secret public demo keys.
5. **Zero Service Role Key Exposure in Client Code:**
   - `src/lib/env.ts` enforces `SUPABASE_SERVICE_ROLE_KEY: isServer ? process.env.SUPABASE_SERVICE_ROLE_KEY : undefined`.
   - `src/lib/supabase/admin.ts` enforces server isolation with `import 'server-only';`.
   - Browser client initialization (`src/lib/supabase/browser.ts`) references only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   - Zero occurrences of `SUPABASE_SERVICE_ROLE_KEY` or `createAdminClient` appear in any client-rendered component or browser route.
6. **.gitignore Verification:** All existing build artifacts and sensitive local files (`node_modules/`, `.next/`, `.vercel/`, `.env.local`, `tsconfig.tsbuildinfo`, `next-env.d.ts`) match ignore rules in `.gitignore`.

---

## 2. Git State & Working Tree Audit

### 2.1 Live CLI Execution Output
CLI commands executed in `C:\Users\aksha\Downloads\GST-Sathi-main\GST-Sathi-main`:

```bash
$ git status
fatal: not a git repository (or any of the parent directories): .git (exit code 1)

$ git branch -a
fatal: not a git repository (or any of the parent directories): .git (exit code 1)

$ git log -n 25
fatal: not a git repository (or any of the parent directories): .git (exit code 1)

$ git remote -v
fatal: not a git repository (or any of the parent directories): .git (exit code 1)
```

CLI commands executed in parent directory `C:\Users\aksha\Downloads\GST-Sathi-main`:
```bash
$ git status
fatal: not a git repository (or any of the parent directories): .git (exit code 1)
```

### 2.2 Finding & Exact Root Cause
- **Finding:** Git is **not initialized** in this directory or any parent directory.
- **Classification:** **Unversioned Archive Extract**.
- **Root Cause Analysis:** The workspace directory path `Downloads\GST-Sathi-main\GST-Sathi-main` indicates that a source archive (e.g. GitHub "Download ZIP" from branch `main` or `git archive`) was extracted into the user's `Downloads` folder. GitHub automatically strips the `.git` directory when generating source zip downloads.
- **Impact:**
  - Standard Git CLI commands (`git status`, `git log`, `git diff`, `git push`) cannot function until `git init` or a clone is established.
  - No active branch is checked out in local Git metadata.
  - No unpushed commits or remotes can be queried directly via Git CLI.

### 2.3 Historical Git Context & Commit Trail
Prior QA audit reports preserved in `docs/qa/agent1-secrets-audit.md` and `docs/qa/agent2-remote-sync.md` document the full Git status at the time the snapshot was created:

- **Upstream Repository Remote:** `https://github.com/Mohitfegade/GST-Sathi.git`
- **Tracked Branch:** `main` tracking `origin/main`
- **Remote Base Commit:** `5e206d962bb550172110b9e47b86e1226dcc5f5b` (`origin/main`)
- **Head Commit at Snapshot:** `51e33e67a25d2ca50c59b21ce7c2a13d4cfce41c` (`HEAD`)
- **Recorded Divergence:** 0 commits behind, 8 commits ahead of remote:

| # | Commit SHA | Author | Commit Message Summary | Scope & Areas Modified |
|---|------------|--------|------------------------|------------------------|
| 1 | `63b4844` | Mohitfegade | `chore(clients): contracts` | Client types, interfaces, SQL contracts |
| 2 | `c814a80` | Mohitfegade | `feat(clients): client management for accountants` | Client management module, RLS, search UI |
| 3 | `7a9a84a` | Mohitfegade | `chore(uploads): contracts` | Upload limits, enqueue interfaces, schemas |
| 4 | `acf5092` | Mohitfegade | `feat(db): upload quota, stale cleanup, and confirmation RPCs` | Supabase DB RPCs, quota logic, RLS tests |
| 5 | `811347f` | Mohitfegade | `feat(uploads): direct signed uploads, sniffing, queue, and queries` | Magic byte sniffing, queue, downscaling |
| 6 | `05b5285` | Mohitfegade | `feat(ui): accountant bills tab and shop owner upload portal` | Portal routes, bills tabs, UploadPanel |
| 7 | `f9d4c47` | Mohitfegade | `chore(uploads): dev tooling, synthetic fixtures, QA reports, and ADR-0008` | Synthetic fixtures, dev upload CLI, QA docs |
| 8 | `51e33e6` | Mohitfegade | `fix(next16): remove blocking Date.now() during prerender` | Next.js 16 dynamic render / clock guard |

---

## 3. Sensitive Information & Secrets Audit

### 3.1 Environment Files Scan

| File Path | Status | Sensitivity Level | Contents & Assessment |
|:---|:---:|:---:|:---|
| `.env.example` | Tracked | **None (Safe)** | Public documentation template. Contains only placeholder keys (`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`) and default local loopback URLs (`http://127.0.0.1:54321`, `http://localhost:3000`). Zero credentials or production endpoints. |
| `.env.local` | Ignored | **HIGH (Confidential)** | Present on disk (2,182 bytes). Contains local Supabase URLs and an active/recent Vercel CLI authentication token: `VERCEL_OIDC_TOKEN="eyJhbGciOiJSUzI1Ni..."`. |
| `.env` | Absent | **N/A** | Does not exist on disk. |
| `.env.production` | Absent | **N/A** | Does not exist on disk. |
| `.env.development` | Absent | **N/A** | Does not exist on disk. |
| `.env.test` | Absent | **N/A** | Does not exist on disk. |

#### Detailed Vercel Token Inspection in `.env.local`:
- **Variable:** `VERCEL_OIDC_TOKEN`
- **Issuer:** `https://oidc.vercel.com/akshay-jadhavs-projects-b3a18432`
- **Subject:** `owner:akshay-jadhavs-projects-b3a18432:project:gst-saathi:environment:development`
- **Project ID:** `prj_vIATC9hk2EHQuJeWAB86xdxwqV83`
- **Owner ID:** `team_Na4er6Lp6XCYkzlB0nSKzw9U`
- **User ID:** `d1RTiJfYs9WU2v82IrYN5NZI`
- **Issued At (iat):** `1793987972` (2026-11-06T17:59:32Z)
- **Expires At (exp):** `1794031172` (2026-11-07T05:59:32Z)
- **Assessment:** Generated by Vercel CLI during local environment linkage (`vercel link` / `vercel env pull`). Even though the short-lived JWT has passed its `exp` timestamp, it contains internal account identifiers and project IDs. **It is imperative that `.env.local` remains untracked.**

### 3.2 Vercel Configuration & Artifacts
- **`.vercel/project.json`:**
  - Content: `{"projectId":"prj_vIATC9hk2EHQuJeWAB86xdxwqV83","orgId":"team_Na4er6Lp6XCYkzlB0nSKzw9U","projectName":"gst-saathi"}`
  - Ignored by `.gitignore` (`.vercel`).
- **`vercel.json` (Project Root):**
  - Content: `{"$schema": "https://openapi.vercel.sh/vercel.json", "framework": "nextjs"}`
  - Standard deployment configuration file. Safe to track.
- **`..\vercel.json` (Parent Directory `Downloads\GST-Sathi-main\vercel.json`):**
  - Content: `{"$schema": "https://openapi.vercel.sh/vercel.json", "framework": "nextjs", "rootDirectory": "GST-Sathi-main"}`
  - Defines root directory for monorepo-style or nested folder deployment on Vercel. Safe to track.

### 3.3 Private Keys & Cryptographic Certificates Scan
- Search parameters: `*.pem`, `*.key`, `*.cert`, `*.pfx`, `*.p12`, `*id_rsa*`, `*secret*` across the entire project excluding `node_modules` and `.next`.
- **Results:** **0 private keys or certificates found.**
- All occurrences of "token" or "secret" in code correspond to URL parameters (e.g. `src/app/(auth)/invite/[token]`) or design token checkers (`scripts/check-tokens.mjs`).

### 3.4 Evaluation Datasets & Private Directories Scan
- Search parameters: Directory names or file names matching `*eval*`, `*private*`, `*confidential*` across the repository.
- **Results:** **0 matching directories or files.** No benchmark datasets or private evaluation data are embedded.

### 3.5 Real Bills & Invoices Verification
Files located in `supabase/fixtures/bills/`:
- `fake_invoice_1.png` (9,417 bytes)
- `fake_invoice_2.jpg` (4,034 bytes)
- `fake_invoice_3.pdf` (1,995 bytes)

#### Authenticity & Verification:
- **Source Generator:** `scripts/generate-fake-bills.mjs`.
- **Methodology:** Generated directly in Node.js using bitmap drawing algorithms (`FONT_5X7` ASCII font array, custom zlib compression, and minimal PDF-1.4 stream construction) without third-party graphics tools.
- **Visual & Content Watermarking:** Every file contains prominent text:
  - `"SAMPLE FAKE BILL FOR TESTING ONLY"`
  - `"FAKE - Sharma General Stores"`
  - Fake GSTIN: `"27FAKES1234A1ZJ"`
- **Customer Mock Fixtures:**
  - `supabase/fixtures/clients.fake.json`: 7 client entities, all prefixed with `FAKE - ` (e.g., `FAKE - Sharma General Stores Proprietary Concern`), fake GSTINs (`27FAKES1234A1ZJ`, `27FAKEP5678B1ZW`, `24FAKET9012C1ZC`), and explicit `is_fixture: true` flags.
  - `supabase/fixtures/fake-dev-users.json`: Synthetic test users with `@fake-test.local` email domains and mock passwords (`FakePassword123!`).
  - `supabase/fixtures/fake-tenants.json`: Synthetic CA firms and SME clients.
- **Verdict:** **Zero real customer bills, zero commercial invoices, zero authentic GST returns, and zero personal taxpayer data exist.**

### 3.6 Supabase Service Role Key Isolation & Client Code Audit

#### Verification of `src/lib/env.ts`:
```typescript
SUPABASE_SERVICE_ROLE_KEY: isServer
  ? process.env.SUPABASE_SERVICE_ROLE_KEY
  : undefined,
```
- In the browser bundle (`typeof window !== 'undefined'`), `SUPABASE_SERVICE_ROLE_KEY` evaluates strictly to `undefined`.

#### Verification of `src/lib/supabase/admin.ts`:
```typescript
import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

export function createAdminClient(...) { ... }
```
- Line 1 imports `'server-only'`, causing the Next.js / Webpack / Turbopack compiler to throw an immediate fatal build error if this file or its exports are ever imported into a Client Component.
- Codebase grep confirmed `createAdminClient` is **never imported** by any client components or public route handlers.

#### Verification of `src/lib/supabase/browser.ts`:
```typescript
export function createBrowserClient(...) {
  return createSupabaseBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    options
  );
}
```
- The client-side browser client exclusively accesses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

#### Script Hardcoded Fallbacks:
`scripts/dev-invite.mjs`, `scripts/dev-upload.mjs`, `scripts/seed-clients.mjs`, and `scripts/smoke-test.mjs` define:
```javascript
const DEFAULT_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
```
- **Analysis:** Decoded payload has `iss: "supabase-demo"` and `role: "service_role"`. This is the standard open-source Supabase CLI secret key baked into local Docker images for `localhost:54321`. It has zero access or authority over any hosted Supabase instance.

---

## 4. `.gitignore` vs. Filesystem Analysis

### 4.1 Comparison Matrix

The following table evaluates every category of files currently present in the filesystem against the rules in `.gitignore`:

| Filesystem Item | Present on Disk? | `.gitignore` Pattern | Git Ignore Status | Security / Repo Risk |
|:---|:---:|:---|:---:|:---:|
| `node_modules/` | Yes (~513 MB) | `/node_modules` (line 2) | **Properly Ignored** | None (Third-party dependencies) |
| `.next/` | Yes (Build output) | `/.next/` (line 15) | **Properly Ignored** | None (Turbopack/Next.js cache) |
| `.vercel/` | Yes (`project.json`) | `.vercel` (lines 45, 51) | **Properly Ignored** | None (Protected from commit) |
| `.env.local` | Yes (2,182 bytes) | `.env`, `.env.*`, `.env*.local`, `.env*` (lines 22-24, 52) | **Properly Ignored** | None (OIDC token protected) |
| `tsconfig.tsbuildinfo` | Yes (187 KB) | `*.tsbuildinfo` (line 48) | **Properly Ignored** | None (TypeScript compiler cache) |
| `next-env.d.ts` | Yes (295 bytes) | `next-env.d.ts` (line 49) | **Properly Ignored** | None (Auto-generated types) |
| `.env.example` | Yes (772 bytes) | `!.env.example` (line 25) | **Explicitly Tracked** | None (Public template only) |
| `package-lock.json` | Yes (271 KB) | *(Not in .gitignore)* | **Tracked** | None (Deterministic dependency lockfile) |
| `package.json` | Yes (1.2 KB) | *(Not in .gitignore)* | **Tracked** | None (Project manifest) |
| `vercel.json` | Yes (82 bytes) | *(Not in .gitignore)* | **Tracked** | None (Safe framework configuration) |
| `.cursor/` | Yes (`project.mdc`) | *(Not in .gitignore)* | **Tracked** | None (Shared agent & team project rules) |
| `.github/` | Yes (`ci.yml`) | *(Not in .gitignore)* | **Tracked** | None (GitHub Actions CI pipeline) |
| `docs/` | Yes (Documentation) | *(Not in .gitignore)* | **Tracked** | None (Architecture, QA, contracts) |
| `scripts/` | Yes (CLI tools) | *(Not in .gitignore)* | **Tracked** | None (Developer tooling) |
| `src/` | Yes (Application code) | *(Not in .gitignore)* | **Tracked** | None (Application source code) |
| `supabase/` | Yes (Migrations/fixtures) | *(Not in .gitignore)* | **Tracked** | None (SQL migrations and fixtures) |

### 4.2 `.gitignore` File Structure & Observations
Inspection of `.gitignore` reveals:
```gitignore
# Dependencies
/node_modules
/.pnp
.pnp.*
.yarn/*
!.yarn/patches
!.yarn/plugins
!.yarn/releases
!.yarn/versions

# Testing
/coverage

# Next.js build output
/.next/
/out/

# Production build
/build

# Environment files
.env
.env.*
.env*.local
!.env.example

# Debug logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.pnpm-debug.log*

# OS metadata
.DS_Store
Thumbs.db
*.pem

# IDE / Editor
.idea/
.vscode/*
!.vscode/settings.json
!.vscode/extensions.json

# Vercel
.vercel

# TypeScript
*.tsbuildinfo
next-env.d.ts

.vercel
.env*
```

#### Observations:
1. **Comprehensive Environment Shielding:** The combination of `.env`, `.env.*`, and `.env*.local` with the exception `!.env.example` guarantees that any permutation of environment files (e.g. `.env.local`, `.env.production`, `.env.staging`, `.env.test`) is automatically blocked from staging.
2. **Duplicate Entries Noted:** Lines 51 and 52 append duplicate entries for `.vercel` (already at line 45) and `.env*` (covered at lines 22-24). These duplicates are functionally harmless (Git silently handles duplicates), but represent minor file tidiness debt.
3. **Submodule / Subdirectory Ignore:** `supabase/.gitignore` exists independently and protects Supabase CLI local state:
   - `.branches`
   - `.temp`
   - `.env.keys`
   - `.env.local`
   - `.env.*.local`

---

## 5. Summary & Recommendations

### 5.1 Verification Status
- **Git State:** Unversioned archive extract (no `.git` directory present).
- **Sensitive Data in Code:** Zero secrets, zero live credentials, zero customer bills, zero PII.
- **Service Role Isolation:** Strict (`'server-only'` boundary on admin client; server-only condition on environment variables).
- **Ignore Rules:** All local ephemeral and confidential files (`.env.local`, `.vercel`, `node_modules`, `.next`) are fully covered by `.gitignore`.

### 5.2 Recommendations for Next Steps

1. **Re-initializing Git (if version control is required locally):**
   If this directory is to be connected back to GitHub:
   ```bash
   git init
   git branch -M main
   git remote add origin https://github.com/Mohitfegade/GST-Sathi.git
   git fetch origin
   git reset --mixed origin/main
   ```
   *Caution: Verify with `git status` that `.env.local` and `.vercel` appear under "Ignored" before running any `git add`.*

2. **Vercel OIDC Token Rotation:**
   The `VERCEL_OIDC_TOKEN` in `.env.local` was generated on 2026-11-06 and expired on 2026-11-07T05:59:32Z. If active Vercel CLI operations are required, run:
   ```bash
   vercel env pull .env.local
   ```
   to refresh credentials.

3. **Minor `.gitignore` Cleanup:**
   Remove the trailing duplicate lines 51-52 (`.vercel` and `.env*`) in `.gitignore` during the next routine repository maintenance cycle.
