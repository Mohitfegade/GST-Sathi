# Client Management Specification: GST Saathi

A comprehensive, accountant-first client management specification enabling Chartered Accountants, tax practitioners, and firm staff to onboard, search, filter, edit, archive, and manage SME client businesses and their owner access invitations.

---

## 1. Route Map & User Flows

All client management routes reside under the authenticated accountant app layout (`/app`) and require active firm membership (`staff` or `admin`).

| Route | Authorized Roles | Primary Purpose | Responsive Presentation | Key Components |
|---|---|---|---|---|
| `/app/clients` | Firm `staff`, `admin` | Searchable, filterable client portfolio list with pagination (25/page). | **Mobile (< 768px)**: Touch-friendly stacked cards showing legal name, GSTIN chip, scheme pill, and status badge.<br>**Desktop (≥ 768px)**: Full tabular grid with sorting, status badges, owner access indicators, and action menus. | `ClientTable`, `ClientCard`, `SearchBar`, `FilterChips`, `StatusBadge`, `PaginationControl`, `EmptyState` |
| `/app/clients/new` | Firm `staff`, `admin` | Onboard a new SME client business across 3 structured sections. | Single-column form with sticky primary action bar, instant GSTIN checksum validation, and real-time state badge. | `ClientFormFields`, `GstinInputWithState`, `SchemeSelector`, `TurnoverBandSelector` |
| `/app/clients/[id]` | Firm `staff`, `admin` | Client detail workspace and portal invitation hub. | Header with quick-copy GSTIN, tax scheme, and state pill. Tabbed navigation (Overview, Bills, GSTR-2B, Returns). Collapsible Owner Access panel. | `ClientHeader`, `DetailTabs`, `OwnerAccessCard`, `InviteModal`, `ShareWhatsAppButton` |
| `/app/clients/[id]/edit` | Firm `staff`, `admin` (edit details); `admin` only (archive / restore) | Modify registered business details, manage tax scheme settings, and archive or restore client accounts. | Form fields with dedicated destructive action section at bottom. Staff members see archive controls disabled with plain-English permission notes. | `ClientFormFields`, `ArchiveConfirmationDialog`, `RestoreConfirmationDialog` |

### 1.1 Responsive Viewport Adaptations
- **Mobile Viewport (375px - 767px)**:
  - List view switches from a multi-column table to vertical `ClientCard` elements.
  - Each card presents legal name in bold ink typography, trade name as muted subtitle, GSTIN with 1-click copy, tax scheme pill, and derived compliance status badge.
  - Filter chips scroll horizontally with no visible scrollbar.
  - Search input spans full viewport width.
- **Desktop Viewport (≥ 768px)**:
  - Tabular layout with columns: `Business Name & Trade Name`, `GSTIN & State`, `Scheme`, `Compliance Status`, `Owner Portal`, `Actions`.
  - Header displays total client count and persistent `Add Client` button using `accent` token.
  - Row click navigates to `/app/clients/[id]`.

---

## 2. Core Domain Contracts & Types

### 2.1 Client Form Fields (`ClientForm`)
Data contract used by client creation and modification forms:

```typescript
export interface ClientForm {
  /** Registered statutory entity name as per GST certificate */
  legal_name: string;
  /** Operating shop or display name, if different from legal name */
  trade_name?: string;
  /** 15-character uppercase statutory GST identification number */
  gstin: string;
  /** Statutory taxation scheme */
  scheme: 'regular' | 'qrmp' | 'composition' | 'unregistered';
  /** Annual Aggregate Turnover band for statutory threshold tracking */
  aato_band: 'below_40l' | '40l_to_1_5cr' | '1_5cr_to_5cr' | 'above_5cr';
  /** Whether the business supplies tax-exempt goods (e.g. printed books) */
  sells_exempt: boolean;
  /** Whether the business supplies taxable goods (e.g. stationery, registers) */
  sells_taxable: boolean;
  /** Preferred UI and communication language for SME owner */
  language: 'en' | 'hi' | 'mr';
}
```

### 2.2 Client List Item (`ClientListItem`)
Projection consumed by client list and card views:

```typescript
export type OwnerAccessState = 'none' | 'invited' | 'active';

export interface ClientNames {
  legal_name: string;
  trade_name: string | null;
}

export interface ClientListItem {
  id: string;
  names: ClientNames;
  gstin: string;
  state_name: string;
  scheme: 'regular' | 'qrmp' | 'composition' | 'unregistered';
  status_label: ClientStatusLabel;
  owner_access_state: OwnerAccessState;
  deleted_at?: string | null;
  created_at?: string;
}
```

### 2.3 List Filters & Pagination (`ListFilters`, `PaginatedClients`)
Contracts governing list queries, client-side filters, and pagination:

```typescript
export interface ListFilters {
  /** Case-insensitive substring match against legal name, trade name, or GSTIN */
  search?: string;
  /** Filter by taxation scheme or show all */
  scheme?: 'regular' | 'qrmp' | 'composition' | 'unregistered' | 'all';
  /** Filter by derived compliance status or show all */
  status?: ClientStatusLabel | 'all';
  /** 1-based page number (default: 1, 25 items per page) */
  page?: number;
}

export interface PaginatedClients {
  items: ClientListItem[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
}
```

### 2.4 Database Entity Mapping
The domain model maps to PostgreSQL tables in the `public` schema:

| Domain Model | PostgreSQL Table | Key Columns & Constraints |
|---|---|---|
| `Client` | `public.clients` | `id` (uuid, PK), `firm_id` (uuid, FK), `legal_name` (text), `trade_name` (text), `gstin` (text), `state_code` (text), `scheme` (text), `aato_band` (text), `sells_exempt` (bool), `sells_taxable` (bool), `language` (text), `deleted_at` (timestamptz). |
| `ClientAccess` | `public.client_access` | `id` (uuid, PK), `firm_id` (uuid, FK), `client_id` (uuid, FK), `user_id` (uuid, FK), `role` (`owner` or `staff`), `deleted_at` (timestamptz). |
| `ClientInvite` | `public.client_invites` | `id` (uuid, PK), `firm_id` (uuid, FK), `client_id` (uuid, FK), `token_hash` (text, unique), `expires_at` (timestamptz), `accepted_by` (uuid), `accepted_at` (timestamptz). |

---

## 3. Compliance Status Derivation (Zero Invention Rule)

### 3.1 Strict Data-Driven Status Policy
To uphold complete audit defensibility, **no status is ever fabricated, guessed, or hardcoded**. Status badges reflect the actual operational state of the client's current tax period derived directly from database records in `return_periods`, `documents`, `invoices`, and `recon_runs`.

```
+-----------------------------------------------------------------------+
|                       Zero Invention Hierarchy                        |
|                                                                       |
| 1. Has any return period been opened for the client?                 |
|    NO  --> "No activity yet" (Default for all newly onboarded clients) |
|    YES --> Continue to Step 2                                         |
|                                                                       |
| 2. Are required documents uploaded (purchase bills, sales, 2B)?       |
|    NO  --> "Documents waiting"                                        |
|    YES --> Continue to Step 3                                         |
|                                                                       |
| 3. Are there invoice discrepancies, missing data, or blocked ITC?     |
|    YES --> "Needs attention"                                          |
|    NO  --> Continue to Step 4                                         |
|                                                                       |
| 4. Is reconciliation complete and draft return verified?              |
|    YES --> "Ready for review"                                         |
|                                                                       |
| 5. Has the return been confirmed as filed on gst.gov.in?             |
|    YES --> "Filed"                                                    |
+-----------------------------------------------------------------------+
```

### 3.2 Status Definitions & Visual Tokens

| Status Label | Database Trigger Condition | Theme Token Pairing | Accountant Meaning |
|---|---|---|---|
| **No activity yet** | No return period created, or zero bills uploaded across all periods. | `muted` surface with `muted` ink | Client has been onboarded; waiting for first tax period setup or document intake. |
| **Documents waiting** | Return period exists in `draft` state, but purchase invoices count = 0 or GSTR-2B file has not been imported. | `surface` with `accent` border | Period opened; accountant is waiting for the shopkeeper to upload bills or for the 14th GSTR-2B release. |
| **Needs attention** | Reconciliation run detected discrepancies (rate mismatches, missing supplier invoices, Section 17(5) blocked credits, or Rule 37 180-day reversal warnings). | `surface` with warning line & high-contrast ink | Discrepancies exist; accountant must review line items or follow up with suppliers before filing. |
| **Ready for review** | All uploaded bills reconciled with GSTR-2B, draft GSTR-1 / GSTR-3B generated, and zero blocking validation errors remain. | `surface` with subtle line & `ink` | Return calculations are mathematically verified; ready for CA pre-filing sign-off. |
| **Filed** | Return marked as filed for the active period with filing confirmation timestamp. | `surface` with solid border & strong `ink` | Return submitted on the GST portal; period locked. |

---

## 4. Multi-Tenant Security & Permission Rules

### 4.1 Firm-Level Data Isolation
1. **Tenant Scoping**: Every database read and write against `public.clients`, `public.client_access`, and `public.client_invites` enforces `firm_id = session.firm.id`.
2. **Postgres Row Level Security (RLS)**:
   - Evaluated via `is_firm_member(firm_id)` which inspects `auth.uid()` against active memberships in `public.firm_members`.
   - Direct foreign-key cascade relationships prevent orphaned client data.
3. **Cross-Firm Leak Prevention**: An accountant belonging to Firm A cannot query, update, or discover clients belonging to Firm B, even if they know the client's UUID or GSTIN.

### 4.2 Role Permission Matrix: Firm Admin vs Firm Staff

| Lifecycle Action | Firm Staff | Firm Admin | Platform Admin | Enforcement Mechanism |
|---|---|---|---|---|
| View client list & details | Permitted | Permitted | Permitted | RLS `clients_select` policy (`is_firm_member(firm_id)`) |
| Add new client | Permitted | Permitted | Permitted | RLS `clients_insert` policy |
| Edit client business details | Permitted | Permitted | Permitted | RLS `clients_update` policy |
| **Archive client** (`deleted_at = now()`) | **Denied** | **Permitted** | **Permitted** | Database trigger `trg_check_client_archive_permission` + Server Action check |
| **Restore client** (`deleted_at = null`) | **Denied** | **Permitted** | **Permitted** | Database trigger `trg_check_client_archive_permission` + Server Action check |
| Generate owner portal invite | **Denied** | **Permitted** | **Permitted** | Server action check (`is_firm_admin`) |
| Revoke unaccepted invite | **Denied** | **Permitted** | **Permitted** | RLS `client_invites_delete` (`is_firm_admin AND accepted_at IS NULL`) |
| Modify accepted invite | **Denied** | **Denied** | **Denied** | Immutable audit policy (accepted invites cannot be deleted or updated) |

### 4.3 Client Archiving & Soft-Delete Architecture
- Client deletion is strictly **soft-delete** via `deleted_at timestamptz`. Real client rows and associated financial transactions are never physically dropped from PostgreSQL.
- **Section 36 Compliance**: The CGST Act mandates retention of books of account and tax records for 72 months (6 years) from the due date of the annual return. Soft-deleting ensures full compliance with statutory document preservation rules.
- **Re-registration & Partial Unique Index**:
  - The database enforces uniqueness on `(firm_id, gstin)` exclusively for active clients:
    ```sql
    CREATE UNIQUE INDEX uq_clients_firm_gstin_active
      ON public.clients (firm_id, gstin)
      WHERE deleted_at IS NULL;
    ```
  - If a business closes or pauses services and is archived (`deleted_at IS NOT NULL`), the CA firm can subsequently register the same GSTIN again in the future without index collision.
  - If an admin attempts to restore an archived client whose GSTIN is currently active on another record, PostgreSQL raises a unique constraint violation which the UI catches and presents in plain English.

### 4.4 Owner Portal Invitations Protocol
1. **Cryptographic Generation**:
   - Invitation links are generated using 32 cryptographically secure random bytes:
     ```typescript
     const rawToken = crypto.randomBytes(32).toString('hex'); // 64-char hex string
     ```
2. **Hash-Only Storage (SHA-256)**:
   - The plaintext token is never persisted.
   - The server computes `token_hash = sha256(rawToken)` and stores only the hash in `public.client_invites`.
   - The raw invitation link (`https://app.gstsaathi.in/invite/[rawToken]`) is displayed once in the UI modal for copying or WhatsApp sharing.
3. **Expiration & Single-Use**:
   - Invitations expire automatically after **7 days** (`expires_at = now() + interval '7 days'`).
   - Token acceptance invokes the PostgreSQL atomic procedure `public.accept_client_invite(p_token_hash)`.
   - The row is locked (`FOR UPDATE`), validated for expiration and null `accepted_at`, marks `accepted_at = now()`, creates the `client_access` owner record, and writes an audit entry in a single atomic transaction.
4. **Revocation**:
   - An admin can revoke an outstanding invite at any time prior to acceptance. Once revoked, the invite row is deleted, immediately invalidating the link.

---

## 5. GSTIN Validation Rules & State Code Derivation

### 5.1 15-Character GSTIN Anatomy
Every Goods and Services Tax Identification Number (GSTIN) issued in India adheres to a strict 15-character alphanumeric format under Rule 8 of the CGST Rules, 2017:

$$\underbrace{\mathtt{27}}_{\text{1-2: State Code}} \; \underbrace{\mathtt{ABCDE1234F}}_{\text{3-12: 10-Digit Entity PAN}} \; \underbrace{\mathtt{1}}_{\text{13: Entity Code}} \; \underbrace{\mathtt{Z}}_{\text{14: Fixed}} \; \underbrace{\mathtt{5}}_{\text{15: Checksum}}$$

| Character Position | Statutory Field | Permitted Characters | Validation Logic |
|---|---|---|---|
| **Positions 1-2** | State / Union Territory Code | `01` to `38`, `97`, `99` | Numeric 2-digit code representing taxpayer registration state. Must exist in official GSTN state lookup table. |
| **Positions 3-7** | PAN First 5 Letters | `A` to `Z` | Alphabetic characters representing entity type (e.g. `P` for Person/Proprietor, `C` for Company, `F` for Partnership Firm). |
| **Positions 8-11** | PAN Sequential Digits | `0` to `9` | 4-digit sequential numeric string. |
| **Position 12** | PAN Check Character | `A` to `Z` | Alphabetic check character of the statutory PAN. |
| **Position 13** | Entity Number | `1` to `9`, `A` to `Z` | Order of registration for the same PAN within the same state (1st entity is `1`, 2nd is `2`, 10th is `A`). |
| **Position 14** | Default Constant | `Z` | Fixed statutory default character (always uppercase `Z`). |
| **Position 15** | Modulo-36 Checksum | `0` to `9`, `A` to `Z` | Statutory verification character computed via Luhn Mod-36 algorithm over first 14 characters. |

### 5.2 Official Regular Expression
```regex
^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$
```

### 5.3 Luhn Modulo-36 Checksum Verification Algorithm
The 15th character verifies the integrity of the preceding 14 characters using the standard base-36 variant of the ISO/IEC 7064 Modulo 37,36 / Luhn algorithm:

1. **Alphabet & Base**:
   $$\text{Alphabet} = \mathtt{"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"} \quad (\text{Base } M = 36)$$
2. **Weight Factors**:
   - Alternates between $1$ and $2$ across character indices $0$ through $13$:
     $$\text{factor}(i) = \begin{cases} 1 & \text{if } i \text{ is even } (0, 2, 4, 6, 8, 10, 12) \\ 2 & \text{if } i \text{ is odd } (1, 3, 5, 7, 9, 11, 13) \end{cases}$$
3. **Step-by-Step Mathematical Calculation**:
   - For each character $C_i$ at index $i \in [0, 13]$:
     - Find numeric value $V_i = \text{indexOf}(C_i)$ in the alphabet ($0 \le V_i \le 35$).
     - Calculate product: $P_i = V_i \times \text{factor}(i)$.
     - Compute digit sum in base 36: $S_i = \lfloor P_i / 36 \rfloor + (P_i \bmod 36)$.
     - Accumulate running total: $\text{Total} = \sum_{i=0}^{13} S_i$.
   - Calculate check remainder:
     $$\text{Remainder} = \text{Total} \bmod 36$$
   - Determine expected checksum index:
     $$\text{CheckIndex} = (36 - \text{Remainder}) \bmod 36$$
   - Expected checksum character:
     $$\text{ExpectedChecksum} = \text{Alphabet}[\text{CheckIndex}]$$
4. **Validation Check**:
   - Compare $\text{ExpectedChecksum}$ against $C_{14}$ (the 15th character).
   - If they do not match, the GSTIN is structurally invalid and rejected.

### 5.4 Automatic State Code Derivation
- When the user types or pastes into the GSTIN input, the client form extracts the first two digits.
- The system queries `STATE_CODE_MAP` in real time:
  - If recognized (e.g. `27`): Renders a state badge ("Maharashtra") next to the input.
  - If unrecognized (e.g. `45`): Displays an error note ("Invalid state code '45'. Enter a valid 2-digit Indian state code.").
  - If incomplete (< 2 characters): Leaves state indicator neutral.

---

## 6. Error Handling & Plain-English Messaging Guidelines

In accordance with project design principles, all user-facing errors must be written in direct, non-technical plain English. Never leak database column names, raw SQL errors, stack traces, or technical acronyms to the user.

### 6.1 Validation & System Error Dictionary

| Error Scenario | Technical Cause | Plain-English UI Message | Actionable Remedy Provided |
|---|---|---|---|
| **Duplicate Active GSTIN** | `uq_clients_firm_gstin_active` unique index violation | "A client with this GSTIN is already active in your firm." | Highlights existing client link or suggests checking the client list. |
| **Invalid GSTIN Structure** | Failed `GSTIN_REGEX` pattern match | "Check your GSTIN. It must be 15 characters: 2 state digits, 10-character PAN, entity number, 'Z', and check digit." | Keeps entered text and highlights the exact mismatched character range. |
| **Invalid GSTIN Checksum** | Luhn Mod-36 check digit mismatch | "The last character of this GSTIN is incorrect. Please check the GST certificate and retype." | Displays expected character vs entered character for fast typing correction. |
| **Invalid State Code** | State digits not found in `STATE_CODES` | "State code '[code]' is not recognized. Check the first 2 digits of the GSTIN." | Prompts user to verify the state digits against the shop's state. |
| **Missing Legal Name** | Empty `legal_name` field | "Enter the registered legal name of the business." | Auto-focuses the legal name input field. |
| **Unauthorized Archive Attempt** | Staff user attempting to archive a client | "Only firm administrators can archive or restore clients." | Informs staff to request action from firm admin partner. |
| **Restoring Duplicate GSTIN** | Restoring an archived client whose GSTIN is active on another row | "Cannot restore this client. Another active client in your firm already uses this GSTIN." | Prompts admin to archive or edit the conflicting client before restoring. |
| **Expired Owner Invite** | `expires_at < now()` on invite token | "This invitation link has expired. Ask your accountant to send a new link." | Displays accountant firm name and contact info. |
| **Already Accepted Invite** | `accepted_at IS NOT NULL` on invite token | "This invitation link has already been used. Please log in with your registered email." | Provides a direct button to `/login`. |
| **Network / Server Failure** | Uncaught 500 or network drop during action | "We could not save your changes. Please check your connection and try again." | Provides a single "Try Again" button. |

### 6.2 UI Guidelines for Client Forms
- **One Clear Primary Action**: Forms have exactly one primary submit button ("Save Client" or "Update Client") using the `accent` token.
- **Cancel Button**: A clear secondary text button ("Cancel") navigating back to the previous view without saving.
- **Real-Time Feedback**: GSTIN uppercase transformation happens automatically on blur/input (`text-transform: uppercase`).
- **No Emojis**: Status indicators, buttons, alerts, and badges strictly avoid emojis, relying on high-contrast text and border tokens.
