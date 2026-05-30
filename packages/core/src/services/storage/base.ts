export type StorageObjectMetadata = {
    contentType?: string;
};

export interface ObjectStorageService {
    bucketName: string;

    put(
        key: string,
        body: Buffer | string,
        metadata?: StorageObjectMetadata,
    ): Promise<string>;
    get(key: string): Promise<Buffer>;
    delete(key: string): Promise<void>;
    exists(key: string): Promise<boolean>;
}
