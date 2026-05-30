import type { ObjectStorageService, StorageObjectMetadata } from "./base";

export class InMemoryObjectStorageService implements ObjectStorageService {
    private files = new Map<string, Buffer>();

    constructor(public readonly bucketName = "test-bucket") {}

    async put(
        key: string,
        body: Buffer | string,
        _metadata?: StorageObjectMetadata,
    ): Promise<string> {
        this.files.set(key, Buffer.from(toBuffer(body)));
        return key;
    }

    async get(key: string): Promise<Buffer> {
        const file = this.files.get(key);
        if (!file) {
            throw new Error(`Object not found: ${key}`);
        }
        return Buffer.from(file);
    }

    async delete(key: string): Promise<void> {
        this.files.delete(key);
    }

    async exists(key: string): Promise<boolean> {
        return this.files.has(key);
    }

    clear(): void {
        this.files.clear();
    }
}

function toBuffer(body: Buffer | string): Buffer {
    return typeof body === "string" ? Buffer.from(body) : body;
}
