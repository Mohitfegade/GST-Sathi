import { createHash, randomUUID } from 'node:crypto';

export interface UploadBillInput {
  name: string;
  mimeType: string;
  buffer: Buffer | Uint8Array;
  client_id: string;
  firm_id: string;
}

export interface UploadBillResult {
  document_id: string;
  sha256: string;
  storage_path: string;
}

export interface GetBillResult {
  buffer: Buffer | Uint8Array;
  mimeType: string;
}

export interface StoredBillRecord {
  document_id: string;
  name: string;
  mimeType: string;
  buffer: Buffer | Uint8Array;
  client_id: string;
  firm_id: string;
  sha256: string;
  storage_path: string;
  created_at: Date;
}

export interface BillSourceAdapter {
  uploadBill(file: {
    name: string;
    mimeType: string;
    buffer: Buffer | Uint8Array;
    client_id: string;
    firm_id: string;
  }): Promise<{ document_id: string; sha256: string; storage_path: string }>;

  getBill(storage_path: string): Promise<{ buffer: Buffer | Uint8Array; mimeType: string }>;
}

export class InMemoryBillSourceAdapter implements BillSourceAdapter {
  private readonly store = new Map<string, StoredBillRecord>();

  async uploadBill(file: {
    name: string;
    mimeType: string;
    buffer: Buffer | Uint8Array;
    client_id: string;
    firm_id: string;
  }): Promise<{ document_id: string; sha256: string; storage_path: string }> {
    const document_id = randomUUID();
    const sha256 = createHash('sha256').update(file.buffer).digest('hex');
    const storage_path = `${file.firm_id}/${file.client_id}/${document_id}-${file.name}`;

    const record: StoredBillRecord = {
      document_id,
      name: file.name,
      mimeType: file.mimeType,
      buffer: file.buffer,
      client_id: file.client_id,
      firm_id: file.firm_id,
      sha256,
      storage_path,
      created_at: new Date(),
    };

    this.store.set(storage_path, record);

    return {
      document_id,
      sha256,
      storage_path,
    };
  }

  async getBill(storage_path: string): Promise<{ buffer: Buffer | Uint8Array; mimeType: string }> {
    const record = this.store.get(storage_path);
    if (!record) {
      throw new Error(`Bill not found at storage path: ${storage_path}`);
    }

    return {
      buffer: record.buffer,
      mimeType: record.mimeType,
    };
  }

  getAllBills(): StoredBillRecord[] {
    return Array.from(this.store.values());
  }

  clear(): void {
    this.store.clear();
  }
}
