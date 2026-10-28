# GST Saathi

GST compliance platform for accountants and the small shops they serve in India.
Simplifies bill matching with GSTR-2B and return preparation.

## Getting Started

### Prerequisites

- Node.js 18.x or later
- npm

### Installation & Run Steps

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Phone Preview on Same Wi-Fi

To preview the app on your mobile phone connected to the same Wi-Fi network:

```bash
npm run dev -- --hostname 0.0.0.0
```

Access it on your phone using `http://<your-local-ip>:3000`.

## How to Rename the App

The app name is centralized in configuration:
- Edit the `name` property in [`src/config/site.ts`](src/config/site.ts):
   ```ts
   export const siteConfig: SiteConfig = {
     name: "Your App Name",
     // ...
   };
   ```
All navigation headers, titles, and site metadata read directly from this file.

## Folder Map

```text
├── docs/                 # Project documentation and specifications
│   ├── AUTH.md           # Authentication, session lifecycle, and route matrix
│   ├── DECISIONS.md      # Key architecture and design decisions
│   ├── PRODUCT_BRIEF.md  # Product vision and scope
│   ├── PROMPT_PLAN.md    # Implementation roadmap
│   └── RULES_TO_VERIFY.md# Quality and compliance checklists
├── public/               # Static assets and icons
├── scripts/              # Development scripts and CLI tooling
│   ├── check-schema-sync.mjs # Verifies DB migrations match domain models
│   ├── check-tokens.mjs      # Validates design tokens and CSS variables
│   ├── dev-invite.mjs        # Generates test invitation links for SME clients
│   ├── dev-upload.mjs        # Uploads test purchase bills for local development
│   ├── generate-fake-bills.mjs # Generates synthetic test bill fixtures
│   ├── seed-clients.mjs      # Seeds 12 fake SME client businesses
│   └── seed-fixtures.mjs     # Seeds local mock database records
├── src/
│   ├── app/              # Next.js App Router (pages, layout, globals.css)
│   ├── components/       # UI components (auth, layout, sections, ui primitives)
│   ├── config/           # Centralized site configuration
│   └── lib/              # Core business logic, auth session, supabase clients
├── supabase/             # Supabase configuration, migrations, fixtures, and tests
│   ├── fixtures/         # Mock development fixtures (fake tenants, users, & bills)
│   │   └── bills/        # Synthetic sample purchase bills (PNG, JPG, PDF)
│   ├── migrations/       # SQL migrations for database schema & RLS policies
│   └── tests/            # pgTAP database tests
├── .editorconfig         # Consistent editor formatting settings
├── .env.example          # Sample environment variables template
├── .gitignore            # Git exclusion rules
├── .prettierrc           # Prettier code style configuration
├── package.json          # Project scripts and dependencies
└── tsconfig.json         # TypeScript configuration
```

## Database & Local Supabase

This project uses [Supabase](https://supabase.com/) for PostgreSQL database storage, Row Level Security (RLS), authentication, and file storage.

### 1. Local Supabase Setup
Start local Supabase containers (requires Docker):
```bash
npm run db:start
```
Once started, the Supabase local dashboard (Studio) is available at `http://localhost:54323`, and the API gateway at `http://127.0.0.1:54321`.

### 2. Database Reset & Migrations
To reset the local database and run all migrations from `supabase/migrations/`:
```bash
npm run db:reset
```

### 3. Type Generation
To generate TypeScript definitions from the local database schema into `src/lib/database.types.ts`:
```bash
npm run db:types
```

### 4. Running Database RLS Tests
To run database and Row Level Security (RLS) tests:
```bash
npm run db:test
```

### 5. Seeding Fake Test Fixtures
To populate the local database with sample development fixtures:
```bash
# Seed directly into running Supabase instance:
node scripts/seed-fixtures.mjs

# Or generate/preview raw SQL statements:
node scripts/seed-fixtures.mjs --sql
```
> **Note:** All fixture data in `supabase/fixtures/fake-tenants.json` and `supabase/fixtures/fake-dev-users.json` is synthetic and strictly labeled `[FAKE]` for local testing only.

### 6. Seeding Fake SME Client Businesses
To populate the local database with 12 realistic but strictly fake SME retail and wholesale clients (covering regular, QRMP, and composition schemes across 6 states with diverse turnover bands):
```bash
npm run db:seed:clients
```
Options:
```bash
# Target a specific firm UUID:
node scripts/seed-clients.mjs --firm=<firm_uuid>
```
> **Note:** All client records in `supabase/fixtures/clients.fake.json` are synthetic test fixtures with names clearly prefixed with `FAKE - ` and GSTINs carrying valid Luhn mod-36 checksums.

## Auth & Local Development

### 1. Accountant Registration
To register a new Chartered Accountant (CA) or tax professional account:
1. Navigate to [`http://localhost:3000/signup`](http://localhost:3000/signup).
2. Enter your email, password, and firm name.
3. Upon completion, the registration flow creates your user credentials, automatically provisions your CA firm tenant, assigns you the `admin` role, and redirects you directly to the accountant workspace at [`/app`](http://localhost:3000/app).

### 2. Generating Client Invites
SME shop owners are invited directly by accountants to upload purchase bills and review tax returns. To generate an invite link locally without needing external SMTP services:
```bash
# Generate invite for the first active client (or fake fixture client):
npm run dev:invite

# Or generate an invite for a specific client UUID:
npm run dev:invite -- --client=<client_id>
```
The script outputs a cryptographically secure 7-day single-use invitation URL:
```text
Invite Link :
  http://localhost:3000/invite/16abc600ef32309320b039087391d3e9a8de5aa735db0edc7fc26bec52569136
```
Opening this link allows testing the shopkeeper onboarding workflow into the client portal at [`/portal`](http://localhost:3000/portal).

### 3. Local Email Inbox (Inbucket / Mailpit)
During local development, Supabase intercepts all outbound emails (such as confirmation messages, magic links, OTP codes, and password reset instructions). No actual external emails are delivered to public networks.
- **Local Mailbox Web UI:** [`http://localhost:54324`](http://localhost:54324)
- All dispatched emails appear in this inbox immediately with their full subject, sender, and HTML/text body content.

### 4. Logging in with Email Codes Locally
To test passwordless or OTP-based authentication:
1. Visit [`http://localhost:3000/login`](http://localhost:3000/login).
2. Enter your email and request a magic link or one-time passcode (OTP).
3. Open the local mail client at [`http://localhost:54324`](http://localhost:54324).
4. Copy the 6-digit verification code or click the verification link in the received message.
5. Enter the code on the login page to complete authentication. Session state and role routing (`/app` for CA accountants, `/portal` for client owners, or `/no-access` for unaffiliated users) will be resolved automatically.

### 5. Fake Development User Profiles
Predefined test personas are documented in [`supabase/fixtures/fake-dev-users.json`](supabase/fixtures/fake-dev-users.json), including:
- **CA Firm Admin:** `ca_admin@fake-test.local` (Routes to `/app`)
- **CA Firm Staff:** `ca_staff@fake-test.local` (Routes to `/app`)
- **SME Client Owner:** `shop_owner@fake-test.local` (Routes to `/portal`)
- **Unaffiliated User:** `no_access@fake-test.local` (Routes to `/no-access`)

## Uploads

GST Saathi supports direct-to-storage document uploads for purchase bills, allowing SME shop owners and accountants to upload bills without routing large binary streams through the application server.

### 1. How Purchase-Bill Uploads Work

1. **Client-Side Preparation & Checksums:**
   - The user selects files in the web interface.
   - Files are validated locally for size, extension, and magic numbers (MIME sniffing).
   - High-resolution images are downscaled in-browser (max edge 2000px, JPEG quality 0.85) to optimize storage and upload bandwidth.
   - A client-scoped SHA-256 hash is computed using SubtleCrypto / Web Crypto.
2. **Quota & Rate Limiting:**
   - The backend checks hourly upload quotas via `check_upload_quota` (maximum 100 uploads per client per hour).
3. **Storage Isolation & Signing:**
   - Files are stored in the private Supabase Storage bucket `documents`.
   - The canonical storage path follows strict multi-tenant isolation:
     ```text
     ${firm_id}/${client_id}/${document_id}
     ```
   - Row Level Security (RLS) policies on `storage.objects` ensure only authorized CA firm accountants or the specific client owner can access files.
4. **Direct-to-Storage Upload:**
   - The browser uploads directly to the storage bucket using a short-lived signed upload URL.
5. **Confirmation & Queueing:**
   - Upon upload completion, `confirm_document_upload` verifies that the object exists in storage and transitions document status from `uploaded` to `queued`.
   - The document is then queued for background data and text extraction.

### 2. File Format Requirements

- **Supported Formats:**
  - JPEG (`image/jpeg`, `.jpg`, `.jpeg`)
  - PNG (`image/png`, `.png`)
  - WebP (`image/webp`, `.webp`)
  - PDF (`application/pdf`, `.pdf`)
- **Max File Size:** Up to **10 MB** per file (`10 * 1024 * 1024` bytes).
- **Batch Limit:** Up to 20 files per upload batch.
- **Magic Byte Validation:** Files are verified using leading magic bytes to prevent file extension spoofing:
  - JPEG: `FF D8 FF`
  - PNG: `89 50 4E 47 0D 0A 1A 0A`
  - PDF: `%PDF-` (`25 50 44 46 2D`)
  - WebP: `RIFF....WEBP`

### 3. Development Upload Scripts

For local development and testing, synthetic bills and upload CLI tooling are provided:

#### Upload Synthetic Bills Locally
Upload one or more fake sample bills from `supabase/fixtures/bills/` directly for a client:
```bash
# Upload all 3 sample bills for the first active client:
npm run dev:upload

# Upload for a specific client UUID:
npm run dev:upload -- --client=<client_id>

# Upload a single specific fixture file:
npm run dev:upload -- --file=fake_invoice_1.png

# Clean up previous fixture uploads before re-uploading:
npm run dev:upload -- --clean
```

#### Clean Up Stale Uploads
Purges unconfirmed uploads left in `uploaded` status past the 1-hour timeout window:
```bash
npm run uploads:cleanup
```

#### Generate / Regenerate Synthetic Bill Fixtures
Creates 3 clearly synthetic bills with visible `FAKE` watermarks in `supabase/fixtures/bills/`:
```bash
node scripts/generate-fake-bills.mjs

# Or force overwrite:
node scripts/generate-fake-bills.mjs --force
```
Fixture files generated:
- `supabase/fixtures/bills/fake_invoice_1.png` - 640x480 PNG with rendered fake invoice and prominent watermark.
- `supabase/fixtures/bills/fake_invoice_2.jpg` - 640x480 baseline JPEG with JFIF & COM watermark.
- `supabase/fixtures/bills/fake_invoice_3.pdf` - PDF-1.4 document containing `"SAMPLE FAKE BILL FOR TESTING ONLY"`.

## Scripts

- `npm run dev` - Run development server
- `npm run build` - Build the application for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript typecheck
- `npm run dev:invite` - Generate client onboarding invitation link
- `npm run dev:upload` - Upload synthetic sample purchase bills for local development
- `npm run uploads:cleanup` - Clean up stale unconfirmed uploads past 1-hour timeout
- `npm run db:start` - Start local Supabase instance
- `npm run db:reset` - Reset database and run migrations
- `npm run db:seed:clients` - Populate 12 fake SME client businesses for local development
- `npm run db:types` - Generate TypeScript types from local schema
- `npm run db:test` - Run Supabase db tests
- `npm run test` - Run tests with Vitest
- `npm run check:schema` - Verify schema synchronization
