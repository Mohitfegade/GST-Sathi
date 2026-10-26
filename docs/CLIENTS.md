# Client Management Specification: GST Saathi

A comprehensive, accountant-first client management system enabling CA firms and tax practitioners to add, list, search, filter, edit, and archive SME client businesses, as well as manage owner access invitations.

---

## 1. Route Map

All routes exist under the accountant app layout (`/app`) and require an active firm membership (`staff` or `admin`).

| Route | Role Access | Purpose | Key Components |
|---|---|---|---|
| `/app/clients` | Firm `staff`, `admin` | Searchable, filterable client list with pagination (25/page). Switches between responsive cards (mobile `< 768px`) and data table (desktop `≥ 768px`). Empty state when 0 clients. | `ClientTable`, `ClientCard`, `SearchBar`, `FilterChips`, `StatusBadge`, `EmptyState` |
| `/app/clients/new` | Firm `staff`, `admin` | Add client business form. 3 clear sections: Business info, Tax scheme & turnover, What the shop sells. Live GSTIN validation and automatic state detection. | `ClientFormFields` |
| `/app/clients/[id]` | Firm `staff`, `admin` | Client detail shell. Header with GSTIN, state, and tax scheme. Tabs: Overview, Bills, GSTR-2B, Returns. Owner access panel (invite link, WhatsApp share, revoke). | `ClientHeader`, `DetailTabs`, `OwnerAccess`, `ComingNext` |
| `/app/clients/[id]/edit` | Firm `staff`, `admin` (edit); `admin` only (archive/restore) | Edit business details. Soft delete / archive with plain-language confirmation dialog ("Hide this client? Their data is kept."). Restore archived clients. | `ClientFormFields`, Archive / Restore Confirmation Dialogs |

---

## 2. Core Domain Contracts

### 2.1 Client Form Fields (`ClientForm`)
- `legal_name` (string, required): Statutory registered business name.
- `trade_name` (string, optional): Operating shop name if different from legal name.
- `gstin` (string, required): 15-character statutory GST identification number, uppercase, modulo-36 verified.
- `scheme` (`regular` | `qrmp` | `composition` | `unregistered`, default: `regular`): GST taxation scheme.
- `aato_band` (`below_40l` | `40l_to_1_5cr` | `1_5cr_to_5cr` | `above_5cr`, default: `below_40l`): Annual Aggregate Turnover band.
- `sells_exempt` (boolean, default: `false`): Whether the business sells tax-exempt goods.
- `sells_taxable` (boolean, default: `true`): Whether the business sells taxable supplies.
- `language` (`en` | `hi` | `mr`, default: `en`): Preferred notification and interface language.

### 2.2 Client List Item (`ClientListItem`)
- `id` (uuid): Client identifier.
- `names`: `{ legal_name: string; trade_name: string | null }`: Display names.
- `gstin` (string): 15-character GSTIN.
- `state_name` (string): Derived human-readable state name (e.g. "Maharashtra" for code `27`).
- `scheme` (`regular` | `qrmp` | `composition` | `unregistered`): Tax scheme.
- `status_label` (`No activity yet` | `Documents waiting` | `Needs attention` | `Ready for review` | `Filed`): Derived status from real activity records.
- `owner_access_state` (`none` | `invited` | `active`): Real state of SME owner portal access.

### 2.3 List Filters & Pagination (`ListFilters`)
- `search` (string, optional): Search query matching legal name, trade name, or GSTIN (case-insensitive).
- `scheme` (`Scheme` | `'all'`, optional): Filter by taxation scheme.
- `status` (`ClientStatusLabel` | `'all'`, optional): Filter by compliance status.
- `page` (number, default: 1): 25 clients per page.

---

## 3. Compliance Status Derivation (Zero Invention Rule)

Statuses are derived exclusively from real database records in `return_periods`, `documents`, and `reconciliations`. No statuses are fabricated:

1. **"No activity yet"**: Default state when no return periods, bills, or documents exist for the client.
2. **"Documents waiting"**: Return period opened, but awaiting purchase/sales bills or GSTR-2B.
3. **"Needs attention"**: Unmatched invoices, supplier mismatches, or missing tax data.
4. **"Ready for review"**: All uploaded documents reconciled with GSTR-2B; draft return ready for accountant sign-off.
5. **"Filed"**: Return filed on the GST portal for the active period.

In the current stage (prior to bills and returns uploads), every client evaluates strictly to **"No activity yet"**.

---

## 4. Multi-Tenant Security & Permissions

1. **Firm Isolation**: All client queries enforce `firm_id = session.firm.id` and RLS `is_firm_member(firm_id)`.
2. **Create / Edit**: Both firm `admin` and `staff` may create and edit client details.
3. **Archive / Restore**: Only firm `admin` may soft-delete (`deleted_at = now()`) or restore (`deleted_at = null`) clients. Staff attempts are rejected by RLS and server actions.
4. **GSTIN Uniqueness**: GSTIN is unique per firm among active clients (`where deleted_at is null`). An archived GSTIN can be re-added or restored.
5. **Owner Access Invites**:
   - Only firm admins may generate or revoke invites (`create_client_invite`).
   - Tokens are 32-byte cryptographic random hex, stored only as SHA-256 hashes, valid for 7 days.
   - Raw tokens are displayed once to the creator and never logged or persisted.
   - Revoke is only permitted for pending, unaccepted invites (`accepted_at is null`).
