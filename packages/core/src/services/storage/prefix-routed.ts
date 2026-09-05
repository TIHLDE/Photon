import type { ObjectStorageService, StorageObjectMetadata } from "./base";

const R2_KEY_PREFIX = "r2/";

/** Routes objects by key while legacy and R2 storage coexist. */
export class PrefixRoutedObjectStorageService implements ObjectStorageService {
    readonly bucketName: string;

    constructor(
        private readonly drift: ObjectStorageService,
        private readonly r2: ObjectStorageService,
    ) {
        this.bucketName = `drift:${drift.bucketName},r2:${r2.bucketName}`;
    }

    async put(
        key: string,
        body: Buffer | string,
        metadata?: StorageObjectMetadata,
    ): Promise<string> {
        return await this.storageFor(key).put(key, body, metadata);
    }

    async get(key: string): Promise<Buffer> {
        return await this.storageFor(key).get(key);
    }

    async delete(key: string): Promise<void> {
        await this.storageFor(key).delete(key);
    }

    async exists(key: string): Promise<boolean> {
        return await this.storageFor(key).exists(key);
    }

    private storageFor(key: string): ObjectStorageService {
        return key.startsWith(R2_KEY_PREFIX) ? this.r2 : this.drift;
    }
}
