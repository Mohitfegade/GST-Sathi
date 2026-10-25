export interface PutObjectResult {
  path: string;
}

export interface GetObjectResult {
  data: Uint8Array;
  mimeType: string;
}

export interface DeleteObjectResult {
  success: boolean;
}

export interface StoredStorageObject {
  bucket: string;
  path: string;
  data: Uint8Array;
  mimeType: string;
  updated_at: Date;
}

export interface StorageAdapter {
  putObject(bucket: string, path: string, data: Buffer | Uint8Array, mimeType: string): Promise<{ path: string }>;
  getObject(bucket: string, path: string): Promise<{ data: Uint8Array; mimeType: string }>;
  deleteObject(bucket: string, path: string): Promise<{ success: boolean }>;
}

export class InMemoryStorageAdapter implements StorageAdapter {
  private readonly objects = new Map<string, StoredStorageObject>();

  private makeKey(bucket: string, path: string): string {
    return `${bucket}:::${path}`;
  }

  async putObject(
    bucket: string,
    path: string,
    data: Buffer | Uint8Array,
    mimeType: string
  ): Promise<{ path: string }> {
    const key = this.makeKey(bucket, path);
    const dataCopy = data instanceof Uint8Array ? new Uint8Array(data) : new Uint8Array(Buffer.from(data));

    this.objects.set(key, {
      bucket,
      path,
      data: dataCopy,
      mimeType,
      updated_at: new Date(),
    });

    return { path };
  }

  async getObject(bucket: string, path: string): Promise<{ data: Uint8Array; mimeType: string }> {
    const key = this.makeKey(bucket, path);
    const item = this.objects.get(key);
    if (!item) {
      throw new Error(`Object not found in bucket '${bucket}' at path '${path}'`);
    }

    // Return a fresh Uint8Array copy to protect in-memory store against external mutations
    return {
      data: new Uint8Array(item.data),
      mimeType: item.mimeType,
    };
  }

  async deleteObject(bucket: string, path: string): Promise<{ success: boolean }> {
    const key = this.makeKey(bucket, path);
    const existed = this.objects.delete(key);
    return { success: existed };
  }

  hasObject(bucket: string, path: string): boolean {
    return this.objects.has(this.makeKey(bucket, path));
  }

  listObjects(bucket?: string): StoredStorageObject[] {
    const all = Array.from(this.objects.values());
    if (bucket) {
      return all.filter((o) => o.bucket === bucket);
    }
    return all;
  }

  clear(): void {
    this.objects.clear();
  }
}
