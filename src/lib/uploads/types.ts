import type { AllowedMimeType } from './limits';

export type DocStatus =
  | 'uploaded'
  | 'queued'
  | 'processing'
  | 'needs_review'
  | 'done'
  | 'failed';

export type DocKind =
  | 'purchase_bill'
  | 'gstr2b_file'
  | 'sales_file'
  | 'bank_file'
  | 'other';

/** Input metadata for preparing a single file upload */
export interface PrepareUploadFile {
  originalName: string;
  sizeBytes: number;
  mimeType: AllowedMimeType | string;
  sha256: string;
  periodFp?: string | null;
}

/** Information returned to the browser to execute a direct signed upload */
export interface PreparedUpload {
  documentId: string;
  originalName: string;
  storagePath: string;
  signedUploadUrl: string;
  token?: string;
}

/** Notification for a file that was already uploaded for this client */
export interface DuplicateFileNotice {
  originalName: string;
  sha256: string;
  existingDocumentId: string;
  message: string;
}

/** Result of the prepareUploads action */
export interface PrepareUploadsResult {
  prepared: PreparedUpload[];
  duplicates: DuplicateFileNotice[];
  rejected: Array<{ originalName: string; reason: string }>;
}

/** Document record presented in the UI list */
export interface DocumentListItem {
  id: string;
  firmId: string;
  clientId: string;
  kind: DocKind;
  storagePath: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  status: DocStatus;
  uploadedBy?: string | null;
  periodFp?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Filter criteria for listing documents */
export interface DocumentFilters {
  status?: DocStatus | 'all';
  periodFp?: string | 'all';
  page?: number;
  pageSize?: number;
}

/** Paginated document list response */
export interface PaginatedDocuments {
  items: DocumentListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Document status counts for dashboard summaries */
export interface DocumentStatusCounts {
  total: number;
  uploaded: number;
  queued: number;
  processing: number;
  needsReview: number;
  done: number;
  failed: number;
}

/** Browser-side queue item tracking progress */
export interface UploadQueueItem {
  id: string;
  file: File;
  originalName: string;
  sizeBytes: number;
  progress: number; // 0 to 100
  status:
    | 'idle'
    | 'downscaling'
    | 'hashing'
    | 'preparing'
    | 'uploading'
    | 'confirming'
    | 'done'
    | 'duplicate'
    | 'error';
  error?: string;
  documentId?: string;
}
