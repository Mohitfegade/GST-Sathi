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
│   └── seed-fixtures.mjs     # Seeds local mock database records
├── src/
│   ├── app/              # Next.js App Router (pages, layout, globals.css)
│   ├── components/       # UI components (auth, layout, sections, ui primitives)
│   ├── config/           # Centralized site configuration
│   └── lib/              # Core business logic, auth session, supabase clients
├── supabase/             # Supabase configuration, migrations, fixtures, and tests
│   ├── fixtures/         # Mock development fixtures (fake tenants & fake users)
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

## Scripts

- `npm run dev` - Run development server
- `npm run build` - Build the application for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript typecheck
- `npm run dev:invite` - Generate client onboarding invitation link
- `npm run db:start` - Start local Supabase instance
- `npm run db:reset` - Reset database and run migrations
- `npm run db:types` - Generate TypeScript types from local schema
- `npm run db:test` - Run Supabase db tests
- `npm run test` - Run tests with Vitest
- `npm run check:schema` - Verify schema synchronization
