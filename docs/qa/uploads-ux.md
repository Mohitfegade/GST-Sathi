# Purchase-Bill Uploads — Poor-Network, Mobile UX & Plain-English QA Review Report

**Project:** GST Saathi — Purchase-Bill Uploads & Document Processing  
**Audit Date:** October 28, 2026  
**Auditor:** Reviewer R2 (Poor-Network & Mobile UX Specialist)  
**Conformance Standards:**
- WCAG 2.2 Level AA (Touch Target Sizing 2.5.5/2.5.8, Color Independence 1.4.1, Status Messages 4.1.3)
- Mobile-First Ergonomics (375px compact smartphones, 768px tablets, 1280px desktop displays)
- Variable & Low-Bandwidth Network Resilience (Slow 3G, spotty 4G, high-packet-loss mobile links)
- W3C HTML5 Input Specifications (Camera capture & native gallery selection)
- GST Saathi Design Token Contract (100% semantic tokens, strict light theme, zero `#...` hex codes)

**Scope Surfaces:**
- Queue & Network Concurrency Engine (`src/lib/uploads/client/queue.ts`)
- Client-Side Image Downscaling & Memory Management (`src/lib/uploads/client/downscale.ts`)
- Document Status Poller & Visibility Lifecycle (`src/lib/uploads/client/useDocumentStatus.ts`)
- Status Labels & Accessibility Border Dictionaries (`src/lib/uploads/status-labels.ts`)
- Non-Technical Plain-English Messages & Error Resolvers (`src/lib/uploads/messages.ts`)
- UI Upload Components (`UploadPanel.tsx`, `UploadButton.tsx`, `FileRow.tsx`, `ProgressBar.tsx`, `EmptyBillsState.tsx`, `DocumentList.tsx`)
- Target Application Pages:
  - Small Business & Kirana Portal: `/portal/bills` (`src/app/(portal)/portal/bills/page.tsx`)
  - Chartered Accountant Workspace: `/app/clients/[id]/bills` (`src/app/(app)/app/clients/[id]/bills/page.tsx`)

**Overall Status:** **PASS (EXEMPLARY)**  
All 5 required audit dimensions are implemented with high technical rigor, robust automated tests (74/74 unit tests passing), strict memory bounds, empathetic plain English, and zero hardcoded design token leaks.

---

## 1. Executive Summary & Verification Scorecard

GST Saathi serves two fundamentally distinct user groups in the Indian tax compliance ecosystem:
1. **Chartered Accountants (CAs) and Tax Staff:** Power users running high-resolution desktop and laptop screens in office environments, batch-uploading and categorizing hundreds of client invoices under tight filing deadlines.
2. **Small Business & Kirana Store Owners:** Non-technical merchants operating entry-level Android smartphones (typically 360px–375px viewports) over congested 3G or spotty 4G mobile data connections in tier-2/3 cities and retail markets.

The purchase-bill upload subsystem must guarantee that an owner standing in a retail store with weak connectivity can snap or pick photos of paper bills and receive instant, unambiguous, reassuring feedback without stalled connections, memory crashes, or cryptic technical errors.

### Summary Scorecard

| Audit Dimension | Core Requirement | Implementation Mechanism | Test Verification | Status |
|---|---|---|---|:---:|
| **1. Slow 3G / Poor Network** | Max 3 parallel uploads to prevent socket exhaustion; per-file progress (0–100%); clear summary line ("4 of 5 sent"). | `CONCURRENT_UPLOADS_LIMIT = 3` in `queue.ts`; `XMLHttpRequest.upload.onprogress`; dynamic summary state in `UploadPanel.tsx`. | `queue.test.ts` (concurrency & progress lifecycle) | **PASS** |
| **2. Interrupted Uploads & Offline** | Pause on offline event; reassuring notification banner; auto-resume on online event; exponential backoff retries. | `window.addEventListener('online'/'offline')`; `isOffline` pausing; exponential backoff $1\text{s} \to 2\text{s} \to 4\text{s}$ capped at $10\text{s}$; manual retry button. | `queue.test.ts` (offline pause/resume & exponential backoff) | **PASS** |
| **3. High-Res Camera Photos** | Downscale wide/tall camera photos (max 2000px long edge, JPEG quality 0.85); prompt memory disposal via object URL revocation. | `downscaleImageIfNeeded()` in `downscale.ts`; aspect-ratio preserving 2D canvas downsampling; guaranteed `URL.revokeObjectURL()` in `finally`. | `downscale.test.ts` (11 unit tests covering wide, tall, PDF, SSR, fallback) | **PASS** |
| **4. Mobile Camera Flow** | Unforced capture with `accept="image/jpeg,image/png,image/webp,application/pdf"`; prompt both camera and photo gallery/files. | Standard MIME types without `capture` attribute in `UploadButton.tsx`; `min-h-[48px]` tap targets; `onChange` reset. | DOM inspection & mobile viewport audit | **PASS** |
| **5. Clarity & Plain English** | Distinct, jargon-free status labels and empathetic error messages tailored for accountants vs Kirana owners. | Dictionaries in `status-labels.ts` and `messages.ts`; WCAG 1.4.1 non-color border styles (dotted, dashed, double, groove, solid, ridge). | `resolveUploadErrorMessage()` tests & copy review | **PASS** |

---

## 2. Evaluation Vector 1: Slow 3G & Poor Network Ergonomics

### 2.1 Queue Concurrency & Socket Exhaustion Prevention

#### Technical Challenge
Mobile browsers on Android and iOS enforce strict per-origin HTTP connection pools (typically 6 simultaneous TCP connections per domain). If a multi-file upload batch attempts to open 10 or 20 simultaneous multipart/signed uploads over a slow 3G uplink (150–400 kbps), two fatal failure modes occur:
1. **TCP Buffer Bloat & Head-of-Line Blocking:** Packets compete for limited bandwidth, driving Round-Trip Times (RTT) from 150ms to >3000ms. Keep-alive pings time out, causing connection resets across all uploads.
2. **Socket Starvation:** Auxiliary requests (such as Supabase Auth token refreshes, session checks, and document status polling) are queued behind the stalled uploads, freezing the user interface.

#### Implementation Audit (`src/lib/uploads/client/queue.ts`)
The queue strictly enforces concurrency via the constant `CONCURRENT_UPLOADS_LIMIT = 3` defined in `src/lib/uploads/limits.ts`:

```typescript
// src/lib/uploads/client/queue.ts (Lines 171-180, 368-386)
this.concurrency = options.concurrency ?? CONCURRENT_UPLOADS_LIMIT;

private processQueue(): void {
  if (this.isPaused()) {
    return;
  }

  while (this.runningCount < this.concurrency) {
    const nextItem = this.items.find(
      (item) =>
        item.status === 'idle' &&
        !this.waitingRetries.has(item.id) &&
        !this.abortedItems.has(item.id)
    );

    if (!nextItem) break;

    this.runningCount++;
    this.processItem(nextItem).finally(() => {
      this.runningCount--;
      this.processQueue();
    });
  }

  this.checkQueueComplete();
}
```

#### Verification & Assessment
- By limiting active uploads to exactly 3, the browser maintains 3 free socket channels for authentication pings, status queries, and UI responsiveness.
- In `src/lib/uploads/client/__tests__/queue.test.ts`, the test `"respects concurrency limit of 3 parallel uploads"` adds 5 files simultaneously, asserts `maxSimultaneous === 3`, verifies that the 4th upload only dispatches after the 1st finishes, and confirms total completion without socket drops.
- **Rating: PASS (Exemplary)**

---

### 2.2 Granular Per-File Progress Feedback (0% to 100%)

#### Technical Challenge
On 3G connections, transmitting a 500 KB to 1 MB bill photo takes 10 to 25 seconds. Without continuous granular feedback, users assume the application is hung, leading to repeated re-uploads, page refreshes, and duplicate entries.

#### Implementation Audit (`src/lib/uploads/client/queue.ts` & `src/components/uploads/ProgressBar.tsx`)
1. **Transport-Layer Progress:** `defaultUploadFn` uses standard `XMLHttpRequest` with `xhr.upload.onprogress`:
   ```typescript
   // src/lib/uploads/client/queue.ts (Lines 91-99)
   xhr.upload.onprogress = (event) => {
     if (event.lengthComputable && event.total > 0) {
       const percent = Math.min(
         100,
         Math.round((event.loaded / event.total) * 100)
       );
       onProgress(percent);
     }
   };
   ```
2. **State Propagation:** Progress events trigger `setItemProgress`, clamping integers between 0 and 100, and immediately notifying UI subscribers via `onItemProgress` and `onItemUpdate`.
3. **Accessible Visual Rendering:** `ProgressBar.tsx` renders an accessible WCAG progressbar:
   ```tsx
   // src/components/uploads/ProgressBar.tsx (Lines 34-53)
   <div
     role="progressbar"
     aria-valuenow={clampedProgress}
     aria-valuemin={0}
     aria-valuemax={100}
     aria-label={ariaLabel || label}
     className="w-full h-2 rounded-full bg-surface border border-line overflow-hidden"
   >
     <div
       className="h-full bg-accent transition-all duration-200 ease-out rounded-full"
       style={{ width: `${clampedProgress}%` }}
     />
   </div>
   ```
4. **Accessible Readout in FileRow:** In `FileRow.tsx`, when uploading, the row badge dynamically reads `"Sending 45%"` while the progress bar shows `showLabel={true}`, displaying both the status label and the numerical percentage.

#### Rating: PASS

---

### 2.3 Plain Batch Summary Line

#### Implementation Audit (`src/components/uploads/UploadPanel.tsx`)
In `UploadPanel.tsx` (lines 266–299), batch metrics are computed and mapped into plain English strings:

```typescript
// Summary line calculation
if (totalCount > 0) {
  if (isAllSent) {
    summaryLine =
      totalCount === 1
        ? 'Bill sent successfully'
        : `All ${totalCount} bills sent successfully`;
  } else if (isAllProcessed && errorCount > 0) {
    summaryLine = `${sentCount} of ${totalCount} sent. ${errorCount} could not be sent.`;
  } else if (activeCount > 0) {
    summaryLine = `Sending ${sentCount + 1} of ${totalCount}...`;
  } else {
    summaryLine = `${sentCount} of ${totalCount} sent`;
  }
}
```

#### UX & Accessibility Strengths:
- **Live Status Region:** Rendered with `role="status"` and `font-semibold text-ink`, ensuring assistive screen readers announce state transitions as items finish.
- **Visual Activity Dot:** An animated status indicator uses `bg-accent animate-pulse` while uploads are in flight, shifting to solid `bg-ink` when completed.
- **Batch Clearance:** When all files have processed, a `"Clear finished"` action button appears with a 48px touch target (`min-h-[48px] px-3 py-2 text-xs font-semibold text-muted hover:text-ink`), allowing the user to clear the staging area without disrupting the view.

#### Rating: PASS

---

## 3. Evaluation Vector 2: Interrupted Uploads, Offline Resilience & Auto-Resume

### 3.1 Network Event Handling & Offline State Tracking

#### Implementation Audit (`src/lib/uploads/client/queue.ts`)
The `UploadQueue` subscribes to window network events during initialization and cleans them up upon destruction:

```typescript
// src/lib/uploads/client/queue.ts (Lines 182-202, 322-333)
private setupNetworkListeners(): void {
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    this.isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;

    this.onlineHandler = () => {
      this.isOffline = false;
      this.processQueue();
    };

    this.offlineHandler = () => {
      this.isOffline = true;
    };

    window.addEventListener('online', this.onlineHandler);
    window.addEventListener('offline', this.offlineHandler);
  }
}
```

In `UploadPanel.tsx` (lines 158–177), reactive local state mirrors network transitions, presenting a notification banner to the user whenever `navigator.onLine === false`.

---

### 3.2 Empathetic Offline Notification & Zero-Quota-Loss Pausing

#### Technical Advantage
Many mobile uploaders fail silently or burn through retry attempts when network connectivity drops, resulting in an error message saying "Upload Failed" when the user merely walked into an elevator or cellar.

In GST Saathi:
1. **Immediate Queue Pause:** `queue.isPaused()` checks `this.isManuallyPaused || this.isOffline`. When offline, `processQueue()` does not dispatch any waiting items.
2. **Quota Preservation:** In `handleItemError()` (lines 529–533):
   ```typescript
   if (this.isOffline) {
     // Offline: reset to idle so it resumes when back online without consuming retry quota
     this.setItemStatus(item, 'idle');
     return;
   }
   ```
   If a network drop occurs in the middle of a request, the item is restored to `idle` without incrementing `retryCount`.
3. **Automatic Resume:** As soon as `window.dispatchEvent(new Event('online'))` fires, `this.isOffline` flips to `false` and `this.processQueue()` automatically kicks off, picking up exactly where it left off.
4. **Empathetic Banner:**
   ```tsx
   // src/components/uploads/UploadPanel.tsx (Lines 307-314)
   {isOffline && (
     <div
       role="status"
       className="mb-4 p-3 rounded-[8px] bg-surface border-2 border-dashed border-ink text-sm font-medium text-ink"
     >
       {NETWORK_OFFLINE_MESSAGE}
     </div>
   )}
   ```
   **Message Copy:** `"You are currently offline. Sending will resume as soon as you are reconnected."`  
   Tone is calm, supportive, and assures the business owner that their work is safe.

---

### 3.3 Exponential Backoff Auto-Retry on Network Drops

#### Implementation Audit (`src/lib/uploads/client/queue.ts`)
Transient packet loss or gateway glitches trigger automatic exponential backoff:

```typescript
// src/lib/uploads/client/queue.ts (Lines 535-552)
if (item.retryCount < this.maxRetries) {
  item.retryCount++;
  const backoffMs = Math.min(
    this.maxBackoffMs,
    this.initialBackoffMs * Math.pow(this.backoffMultiplier, item.retryCount - 1)
  );

  this.waitingRetries.add(item.id);
  this.setItemStatus(item, 'idle');

  await this.sleep(backoffMs, item.id);
  this.waitingRetries.delete(item.id);

  if (!this.abortedItems.has(item.id) && item.status === 'idle') {
    this.processQueue();
  }
}
```

- **Backoff Parameters:**
  - `initialBackoffMs`: 1,000 ms (1s)
  - `backoffMultiplier`: 2.0
  - `maxBackoffMs`: 10,000 ms (10s)
  - `maxRetries`: 3
- **Calculated Delays:**
  - Attempt 1 failure $\to$ 1,000 ms delay before Attempt 2.
  - Attempt 2 failure $\to$ 2,000 ms delay before Attempt 3.
  - Attempt 3 failure $\to$ 4,000 ms delay before final attempt.
  - Total allowable retries: 3. If still failing, transitions to `error` status.
- **Manual Retry Action:** If all automated retries fail, `FileRow.tsx` surfaces an accessible `Retry` button (`min-h-[48px] min-w-[48px] px-4 py-2.5 rounded-[8px]`), resetting `retryCount` to 0 and allowing the user to trigger another sequence at will.
- **Timer Hygiene:** Active retry timers are tracked in `retryTimers: Map<string, ReturnType<typeof setTimeout>>`. Any abort or queue destroy call clears all timers immediately.

#### Rating: PASS

---

## 4. Evaluation Vector 3: High-Resolution Camera Photos & Browser-Side Downscaling

### 4.1 Smartphone Camera Resolution vs Uplink Constraints

Modern smartphones in India (Samsung Galaxy, Xiaomi Redmi, Vivo, Realme, iPhone) capture photos using 48-megapixel to 108-megapixel sensors. An uncompressed receipt photo typically measures $6000 \times 8000$ to $9000 \times 12000$ pixels and ranges from 6 MB to 20 MB.

#### Transmission & Ingestion Impact:
- **Unoptimized 12 MB photo on 3G (300 kbps):** $\approx 320\text{ seconds}$ (over 5 minutes!), almost certainly exceeding mobile carrier timeouts.
- **Downscaled 500 KB photo on 3G:** $\approx 13\text{ seconds}$, well within stable connection limits.

### 4.2 Downscaling Algorithm Audit (`src/lib/uploads/client/downscale.ts`)

```typescript
// src/lib/uploads/client/downscale.ts (Lines 60-159)
const maxEdge = options?.maxEdge ?? IMAGE_DOWNSCALE_MAX_EDGE; // 2000px
const quality = options?.quality ?? IMAGE_DOWNSCALE_QUALITY;   // 0.85

const width = img.naturalWidth || img.width || 0;
const height = img.naturalHeight || img.height || 0;
const currentMaxEdge = Math.max(width, height);

if (currentMaxEdge <= maxEdge || width === 0 || height === 0) {
  return { file, downscaled: false };
}

let targetWidth: number;
let targetHeight: number;

if (width >= height) {
  targetWidth = maxEdge;
  targetHeight = Math.max(1, Math.round((height * maxEdge) / width));
} else {
  targetHeight = maxEdge;
  targetWidth = Math.max(1, Math.round((width * maxEdge) / height));
}
```

#### Downscaling Attributes Verified:
1. **Aspect Ratio Preservation:** Perfect proportional preservation whether the photo is landscape or portrait.
2. **Quality Setting:** `0.85` JPEG compression preserves invoice legibility (sharp GSTIN, invoice numbers, tax tables, totals) while discarding invisible sensor noise.
3. **Payload Compression:** A $4000 \times 3000$ (12 MB) camera photo scales down to $2000 \times 1500$, compressing to $\sim 450\text{–}650\text{ KB}$—an **$\sim 95\%$ size reduction**.
4. **Target File Name:** Replaces extension with `.jpg` (e.g. `IMG_20261028_120401.png` $\to$ `IMG_20261028_120401.jpg`).
5. **Pass-Through for PDFs & Small Images:**
   - PDFs are not rasterized; they pass through untouched (`downscaled: false`).
   - Photos with max edge $\le 2000\text{px}$ pass through untouched, preventing generational recompression artifacts.

---

### 4.3 Memory Management & Mobile Canvas Safety

Mobile browsers impose strict memory limits on HTML canvas objects:
- **iOS Safari Canvas Ceiling:** iOS enforces a strict total canvas memory limit (approximately 224 MB across all active canvases). Exceeding this limit crashes the browser tab or produces blank white canvases.
- **Entry-Level Android RAM:** Devices with 2 GB to 3 GB total RAM kill background tabs if canvas allocations cause memory spikes.

#### Memory Management Implementations:
1. **Bounded Canvas Dimensions:** By capping the longest edge at 2000px, the maximum RGBA pixel buffer allocated in memory is:
   $$\text{Max Canvas Buffer} = 2000 \times 2000 \times 4\text{ bytes} \approx 16\text{ MB}$$
   This is well below iOS Safari's 224 MB threshold and will not trigger browser out-of-memory termination.
2. **Deterministic Object URL Revocation:**
   ```typescript
   // src/lib/uploads/client/downscale.ts (Lines 163-171)
   finally {
     if (objectUrl && typeof URL.revokeObjectURL === 'function') {
       try {
         URL.revokeObjectURL(objectUrl);
       } catch {
         // Ignore cleanup errors
       }
     }
   }
   ```
   Every object URL allocated via `URL.createObjectURL(file)` is revoked immediately inside the `finally` block, ensuring native blob memory is released back to the OS before upload transmission begins.
3. **Graceful Fallbacks:** If canvas creation, `getContext('2d')`, or `toBlob()` fails for any reason, the function catches the exception and returns the original file unmodified with `downscaled: false`, guaranteeing the user is never blocked.
4. **SSR Safety:** Safe checks for `typeof window === 'undefined' || typeof document === 'undefined'` ensure zero crashes during Next.js server-side rendering or build passes.

#### Rating: PASS (Exemplary)

---

## 5. Evaluation Vector 4: Mobile Camera & File Picker Flow

### 5.1 HTML5 File Input Configuration & Camera Flow

#### Technical Standard
Under the HTML Media Capture specification, setting `capture="environment"` or `capture="user"` on a file input **forces** the browser to immediately launch the camera viewfinder.

While this may seem convenient for photo-taking, it introduces severe UX failures for small business owners in India:
- Many merchants receive bills as PDF attachments or photos via WhatsApp.
- If `capture` is forced, the user **cannot** choose files from their WhatsApp downloads, photo gallery, or device file manager.

#### Implementation Audit (`src/components/uploads/UploadButton.tsx`)
`UploadButton` strictly implements the recommended standard:

```tsx
// src/components/uploads/UploadButton.tsx (Lines 78-93)
const acceptString = ALLOWED_MIME_TYPES.join(',');
// => "image/jpeg,image/png,image/webp,application/pdf"

<input
  ref={inputRef}
  type="file"
  multiple
  accept={acceptString}
  onChange={handleFileChange}
  disabled={disabled}
  tabIndex={-1}
  className="hidden"
  aria-hidden="true"
  data-testid="upload-file-input"
/>
```

#### Mobile Behavior on Android & iOS:
- **Android Chrome:** Because `capture` is omitted and both images and PDFs are accepted in the MIME list, Android triggers its native bottom action sheet with options:
  1. **Camera** (to snap a new photo of a paper bill)
  2. **Media picker / Files** (to select from camera roll, WhatsApp Images, or Documents)
- **iOS Safari:** iOS displays the native action sheet:
  1. **Take Photo**
  2. **Photo Library**
  3. **Choose File** (for PDFs in iCloud / Files)

---

### 5.2 Mobile Touch Ergonomics & Form Hygiene

1. **Touch Target Dimensions:**
   `UploadButton` enforces `min-h-[48px] min-w-[48px] px-6 py-3 text-base font-semibold`. On mobile viewports, `UploadPanel` stretches the button to full width (`w-full sm:w-auto`), making it easy to tap with one hand.
2. **Focus Visibility:** Includes `focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2` for full keyboard accessibility.
3. **Re-Selection State Reset:**
   ```typescript
   // src/components/uploads/UploadButton.tsx (Lines 63-65)
   if (inputRef.current) {
     inputRef.current.value = '';
   }
   ```
   Resetting `input.value = ''` ensures that if a user removes a file and immediately attempts to pick the same file again, the browser `onChange` event reliably fires.

#### Rating: PASS

---

## 6. Evaluation Vector 5: Clarity & Plain-English Multi-Role Messaging

### 6.1 Dual-Role Status Dictionaries (`src/lib/uploads/status-labels.ts`)

A key design innovation in GST Saathi is role-differentiated status wording:
- **Accountants** need concise, action-oriented workflow terms.
- **Business Owners (Clients)** need simple, jargon-free, reassuring language.

| Database Status (`DocStatus`) | Accountant Label (`ACCOUNTANT_STATUS_LABELS`) | Owner / Kirana Label (`OWNER_STATUS_LABELS`) | UX Rationale for Owner Label |
|---|---|---|---|
| `uploaded` | Uploaded | Received | Confirms safe delivery; avoids technical upload jargon. |
| `queued` | Queued | Received | "Queued" causes anxiety for owners; "Received" reassures them. |
| `processing` | Reading | Being read | Reassures the owner that software or staff is actively reading the invoice. |
| `needs_review` | Needs review | Needs a look | Friendly, low-stress prompt that some detail needs manual clarification. |
| `done` | Done | Checked | Clear confirmation that the bill has been verified and accounted for. |
| `failed` | Failed | Could not read, please take the photo again | Actionable and non-blaming; tells the user exactly what to do next. |

---

### 6.2 WCAG 1.4.1 Non-Color-Alone Visual Distinction

To ensure accessibility for color-blind individuals and outdoor screen readability under bright sunlight, statuses are differentiated using distinct border styles in addition to text labels:

```typescript
// src/lib/uploads/status-labels.ts (Lines 74-81)
export const STATUS_BORDER_STYLES: Record<DocStatus, string> = {
  uploaded: 'dotted',
  queued: 'dashed',
  processing: 'double',
  needs_review: 'groove',
  done: 'solid',
  failed: 'ridge',
};
```

In `FileRow.tsx` and `DocumentList.tsx`, badges apply both the CSS border style and an accessible ARIA description (e.g. `aria-label="Being read (double border)"`). A color-blind user or someone using high-contrast mode can distinguish states by border texture alone.

---

### 6.3 Empathetic Plain-English Error Copy (`src/lib/uploads/messages.ts`)

`messages.ts` systematically replaces engineering jargon with supportive plain English:

| Error Category | Technical Root Cause | GST Saathi Plain-English Message |
|---|---|---|
| **Duplicate Bill** | SHA-256 hash collision on `(client_id, sha256)` | `"You already sent this bill"` |
| **Unsupported Format** | MIME type not in whitelist | `"We can only accept photo bills (JPEG, PNG, WebP) or PDF documents. Please take a clear photo or pick a PDF."` |
| **File Too Large** | Size $> 10\text{ MB}$ (HTTP 413) | `"This file is larger than 10 MB. Please send a smaller photo or document."` |
| **Batch Too Large** | Files $> 20$ in single selection | `"You can send up to 20 bills at a time. Please select fewer bills and try again."` |
| **Hourly Limit** | $> 100$ uploads per hour (HTTP 429) | `"You have reached the upload limit for this hour (100 files). Please wait a while before sending more bills."` |
| **Network Disconnect** | `TypeError: Failed to fetch` / offline | `"You are currently offline. Sending will resume as soon as you are reconnected."` |
| **Upload Failure** | Signed URL PUT failure / network drop | `"Could not send this bill. Please tap Retry or choose the file again."` |
| **Soft Delete** | Database soft-delete prompt | `"Hide this bill? It will be removed from this client's list."` |
| **Empty State** | 0 records in return period | `"No bills yet. Tap Add bills to send your first one."` |

The `resolveUploadErrorMessage(error)` helper scans incoming server or network error messages for keywords (e.g., `'sha256'`, `'413'`, `'quota'`, `'offline'`) and returns the appropriate human-friendly message, preventing raw PostgreSQL or S3 error strings from reaching the UI.

#### Rating: PASS (Exemplary)

---

## 7. Evaluation Vector 6: Viewport Testing & Layout Verification

The implementation was evaluated across three core viewports:
- **Mobile (375px):** Entry-level Android devices and iPhone SE.
- **Tablet (768px):** iPad / Android tablet viewports.
- **Desktop (1280px):** Accountant workstation monitors.

### 7.1 Kirana / Shop Owner Portal: `/portal/bills`

1. **Header & Context:**
   - Multi-business switcher (`hasMultipleClients`): On 375px screens, the business dropdown and switch button stack vertically with `min-h-[48px]`. Quick-switch pill links wrap naturally with comfortable padding.
   - Return Month Selector: Dropdown defaults to the current month (e.g. "October 2026"). On mobile, quick month pills (`min-h-[48px]`) allow one-tap switching between recent months.
2. **Prominent "Add bills" Section:**
   - On 375px viewports, the dropzone reduces padding (`p-6 md:p-10`) while the "Add bills" button expands to full width (`w-full sm:w-auto`).
   - Summary line header stacks cleanly on mobile (`flex flex-col sm:flex-row gap-2`).
3. **Recent Bills List:**
   - Rendered as stacked responsive cards (`p-4 sm:p-5 rounded-xl border border-line bg-surface`).
   - Long file names truncate cleanly (`truncate max-w-sm sm:max-w-md`) without causing horizontal scroll.
   - Status badge and "View bill" link (expiring in 5 minutes) wrap neatly on mobile with a top border separation (`pt-2 md:pt-0 border-t md:border-t-0 border-line`).
4. **Horizontal Overflow:** **Zero** horizontal scroll or layout clipping detected at 375px.

---

### 7.2 Accountant Workspace: `/app/clients/[id]/bills`

1. **Breadcrumbs & Navigation:**
   - Breadcrumb navigation (`Clients / [Client Name] / Bills`) uses `min-h-[48px]` inline links and truncates client names smoothly.
   - Back button (`← Back to [Client Name] overview`) provides a generous 48px touch target.
2. **DetailTabs Integration:**
   - Integrated with `DetailTabs`, allowing instant switching between Overview, Invoices, and Bills without losing context.
3. **DocumentList Responsive Adaptability:**
   - **Desktop ($\ge 768\text{px}$):** Renders a structured data table (`hidden md:table`) with Columns: File name, Month, Size, Sent At, Status badge (with accessible border), and Actions (Preview, Delete).
   - **Mobile ($< 768\text{px}$):** Automatically switches to mobile card view (`block md:hidden`). Each card displays the file name, period, size, timestamp, status badge, and actions with minimum 48px touch targets.
4. **Soft Delete Confirmation:**
   - Modal uses `DELETE_CONFIRMATION_MESSAGE`: `"Hide this bill? It will be removed from this client's list."`
   - Accessible dialog backdrop with `Cancel` and `Hide bill` buttons enforcing 48px heights.

---

## 8. Automated Verification & Quality Gates

### 8.1 Vitest Unit & Integration Tests

All 6 upload-specific test suites pass with 100% success:

```
Test Files  6 passed (6)
     Tests  74 passed (74)
  Duration  1.99s
```

#### Detailed Test Coverage:
- `src/lib/uploads/client/__tests__/queue.test.ts` (15/15 passed):
  - Single file status lifecycle transition (`idle` $\to$ `downscaling` $\to$ `hashing` $\to$ `preparing` $\to$ `uploading` $\to$ `confirming` $\to$ `done`).
  - Strict concurrency limiting (3 simultaneous uploads).
  - Cryptographic duplicate interception before upload.
  - Exponential backoff retry on network drops.
  - Retry exhaustion handling.
  - Online/offline pause and automatic resume.
  - In-flight upload aborting.
  - Manual retry reset.
- `src/lib/uploads/client/__tests__/downscale.test.ts` (11/11 passed):
  - Pass-through for non-images (PDFs).
  - Pass-through for images within 2000px limit.
  - Wide image downscaling preserving aspect ratio.
  - Tall image downscaling preserving aspect ratio.
  - JPEG conversion at 0.85 quality.
  - Guaranteed `URL.revokeObjectURL` cleanup.
  - Safe SSR fallback when DOM/canvas is absent.
  - Image decode error and canvas error fallbacks.
- `src/lib/uploads/client/__tests__/useDocumentStatus.test.ts` (16/16 passed):
  - Status polling lifecycle for pending documents.
  - Automatic pause when document tab is hidden (`visibilitychange`).
  - Immediate resume upon tab visibility.
  - Polling termination when all documents reach final statuses (`done`, `failed`, `needs_review`).
- `src/tests/uploads/upload-flow.test.ts` (10/10 passed):
  - End-to-end direct storage upload, signed URLs, queuing, and soft deletion.
- `src/tests/uploads/validation-quota.test.ts` (14/14 passed):
  - SHA-256 duplicate detection, hourly client upload quota, magic-byte MIME validation, file size limits.
- `src/tests/uploads/access-isolation.test.ts` (8/8 passed):
  - Cross-firm isolation, cross-client isolation, soft delete visibility, and stale upload cleanup.

### 8.2 Design Token Audit

Command: `node scripts/check-tokens.mjs`
```
[check-tokens] SUCCESS: No hex colour patterns found in scanned files.
```
All upload UI components strictly utilize semantic design tokens (`bg-background`, `bg-surface`, `text-ink`, `text-muted`, `border-line`, `bg-accent`, `hover:bg-accent-hover`, `text-on-accent`). Exactly zero hex colors, zero gradients, and zero emojis exist in the implementation.

### 8.3 TypeScript & Linter Verification
- `npx tsc --noEmit`: 0 errors.
- `npm run lint`: 0 errors, 0 warnings.

---

## 9. Observations & Recommendations

The implementation is production-ready. The following optional enhancements can be considered for future roadmap cycles:

1. **Optional Image Orientation Normalization (EXIF):**
   Modern mobile browsers (`createImageBitmap` and `Image`) automatically handle EXIF orientation on modern iOS/Android. For older Android WebView versions, a lightweight EXIF orientation check could be added if legacy device support is required.
2. **Camera Lighting Tips for Kirana Owners:**
   In `failed` state cards on `/portal/bills`, the copy already advises: `"We could not read the text clearly. Please take a clear photo under good light and send it again."` Adding a small helper illustration (e.g. "Avoid glare, keep bill flat") could further reduce retakes.
3. **Background Sync API (PWA):**
   If GST Saathi adds progressive web app (PWA) manifest support in the future, the upload queue could leverage the Service Worker Background Sync API to continue uploads if the user accidentally closes their mobile browser.

---

## 10. Audit Conclusion

The purchase-bill upload system in `mysterious-bose` satisfies all accessibility, poor-network resilience, and mobile ergonomics requirements:
- **Queue Concurrency:** Bounded at 3 parallel uploads, preventing mobile TCP socket exhaustion.
- **Granular Progress:** Real-time 0–100% feedback with accessible ARIA progressbars and dynamic summary strings.
- **Offline Resilience:** Seamless offline pausing, empathetic reassurance copy, zero quota deductions during outages, and automatic re-engagement upon reconnection.
- **High-Res Photos:** Browser-side downscaling to 2000px at 0.85 JPEG quality with rigorous memory cleanup and aspect ratio preservation.
- **Mobile Camera Flow:** Standard MIME acceptance without forced capture, honoring both camera and gallery selection workflows.
- **Plain English:** Role-appropriate wording ("Received", "Being read", "Checked") and WCAG 1.4.1 non-color border cues.

**Final Assessment: PASS (Exemplary)**
