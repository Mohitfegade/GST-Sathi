# Uploads Architecture & Specification: Purchase-Bill Upload & Listing

This document defines the direct-to-storage architecture, database contracts, browser-side downscaling engine, and route map for uploading and listing purchase bills in GST Saathi.

---

## 1. Upload Flow

```mermaid
sequenceDiagram
    autonumber
    participant Browser as Client Browser (Accountant / Shop Owner)
    participant NextServer as Next.js Server (Server Action)
    participant SupabaseDB as Supabase Database (Postgres & RLS)
    participant Storage as Supabase Storage (Private "documents" Bucket)

    Note over Browser: User picks 1-20 files (JPEG, PNG, WebP, PDF)
    Browser->>Browser: Downscale images (long edge max 2000px, JPEG 0.85)
    Browser->>Browser: Compute SHA-256 hash & file byte sizes in memory

    Browser->>NextServer: prepareUploads(clientId, fileMetadataList)
    NextServer->>SupabaseDB: Check upload rate limit (max 100/client/hr)
    NextServer->>SupabaseDB: Deduplicate against active documents (same client + SHA-256)
    NextServer->>SupabaseDB: Insert documents with status = 'uploaded'
    NextServer->>Storage: Generate signed upload URLs ({firm_id}/{client_id}/{doc_id})
    NextServer-->>Browser: Return signed upload URLs and list of duplicates

    loop For each non-duplicate file (max 3 concurrent)
        Browser->>Storage: PUT file directly to signed upload URL
        Storage-->>Browser: 200 OK
        Browser->>NextServer: confirmUpload(documentId)
        NextServer->>Storage: Read first bytes (magic-bytes sniff)
        alt Valid magic bytes (JPEG/PNG/WebP/PDF)
            NextServer->>SupabaseDB: RPC confirm_document_upload(document_id)
            SupabaseDB-->>NextServer: Status updated to 'queued'
            NextServer->>NextServer: enqueueExtraction(document_id) [Stub]
            NextServer-->>Browser: Upload confirmed (queued)
        else Invalid magic bytes / Mismatch
            NextServer->>Storage: Delete invalid storage object
            NextServer->>SupabaseDB: RPC fail_document_upload(document_id, reason)
            NextServer-->>Browser: Friendly error ("Unsupported file format")
        end
    end
```

---

## 2. Route Map

| User Role | Route | Description |
|---|---|---|
| **Accountant** | `/app/clients/[id]/bills` | Client Bills dashboard: upload bills directly, list/filter documents (status, month), preview/download signed URLs (5-minute expiry), delete bills. |
| **Shop Owner** | `/portal/bills` | Shop owner bill upload portal: simple month selection, multi-file camera & gallery upload, progress feedback, and recent bill status. |

---

## 3. Storage Architecture & Privacy Rules

1. **Private Bucket**: Stored in Supabase private bucket `'documents'` with public access disabled (`public = false`).
2. **Object Path Convention**: `{firm_id}/{client_id}/{document_id}`.
3. **No Direct Public URLs**: File previews and downloads strictly use short-lived signed URLs (`expiresIn = 300` seconds / 5 minutes).
4. **Direct Browser Uploads**: Files never pass through server memory on upload; browsers upload directly to S3/Supabase storage via signed URLs created by `prepareUploads`.
5. **No Service-Role Key in App Runtime**: User-facing code uses authenticated user sessions via `createServerClient()` ensuring strict RLS enforcement.

---

## 4. Guardrails & Limits

- **Max File Size**: 10 MB per file (`10 * 1024 * 1024` bytes).
- **Max Batch Size**: 20 files per upload batch.
- **Rate Limit**: Maximum 100 uploads per client per hour (enforced by `check_upload_quota` DB function).
- **Allowed MIME Types**: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`.
- **Server-Side Sniffing**: First bytes checked on confirmation (magic bytes) to prevent extension spoofing.
- **Client-Side Downscaling**: High-resolution mobile phone camera photos downscaled in browser before upload (max long edge 2000px, JPEG quality 0.85).
- **Stale Upload Cleanup**: Rows in `uploaded` status older than 1 hour are cleaned up automatically.
