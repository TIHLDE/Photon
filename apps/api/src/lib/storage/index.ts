import {
    type ObjectStorageService,
    PrefixRoutedObjectStorageService,
    S3ObjectStorageService,
} from "@photon/core/services/storage";
import { type DbSchema, schema } from "@photon/db";
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { env } from "~/lib/env";

export interface UploadMetadata {
    originalFilename: string;
    contentType?: string;
    uploadedById?: string;
    /**
     * Whether GET /api/assets/:key may serve this asset. Defaults to "public".
     * Use "private" for anything that must go through its own authorization.
     */
    visibility?: "public" | "private";
}

export interface AssetStorageService {
    bucketName: string;

    upload(
        key: string,
        body: Buffer | string,
        metadata: UploadMetadata,
    ): Promise<string>;
    download(key: string): Promise<Buffer>;
    delete(key: string): Promise<void>;
    exists(key: string): Promise<boolean>;
    getAsset(key: string): Promise<schema.Asset | null>;
    /**
     * Read a cached image variant, or `null` when it has not been generated.
     *
     * Variants live in the object store only — no `asset` row — because they
     * are a cache: derivable from the original at any time, and never anything
     * a user uploaded or can address directly.
     */
    getObject(key: string): Promise<Buffer | null>;
    putObject(key: string, body: Buffer, contentType: string): Promise<void>;
    listAssets(options?: {
        uploadedById?: string;
        limit?: number;
        offset?: number;
    }): Promise<schema.Asset[]>;
    promoteAsset(key: string): Promise<schema.Asset | null>;
    setAssetVisibility(
        key: string,
        visibility: "public" | "private",
    ): Promise<schema.Asset | null>;
}

export type StorageService = AssetStorageService;
export type StorageClient = AssetStorageService;

export class DatabaseAssetStorageService implements AssetStorageService {
    constructor(
        private readonly objectStorage: ObjectStorageService,
        private readonly db: NodePgDatabase<DbSchema>,
    ) {}

    get bucketName(): string {
        return this.objectStorage.bucketName;
    }

    async upload(
        key: string,
        body: Buffer | string,
        metadata: UploadMetadata,
    ): Promise<string> {
        const bodyBuffer = toBuffer(body);

        await this.objectStorage.put(key, bodyBuffer, {
            contentType: metadata.contentType,
        });

        await this.db
            .insert(schema.asset)
            .values({
                key,
                originalFilename: metadata.originalFilename,
                contentType: metadata.contentType,
                size: bodyBuffer.length,
                uploadedById: metadata.uploadedById,
                visibility: metadata.visibility ?? "public",
            })
            .onConflictDoUpdate({
                target: schema.asset.key,
                set: {
                    originalFilename: metadata.originalFilename,
                    contentType: metadata.contentType,
                    size: bodyBuffer.length,
                    uploadedById: metadata.uploadedById,
                    visibility: metadata.visibility ?? "public",
                    updatedAt: new Date(),
                },
            });

        return key;
    }

    async download(key: string): Promise<Buffer> {
        return await this.objectStorage.get(key);
    }

    async delete(key: string): Promise<void> {
        await this.objectStorage.delete(key);
        await this.db.delete(schema.asset).where(eq(schema.asset.key, key));
    }

    async exists(key: string): Promise<boolean> {
        return await this.objectStorage.exists(key);
    }

    async getAsset(key: string): Promise<schema.Asset | null> {
        const asset = await this.db.query.asset.findFirst({
            where: eq(schema.asset.key, key),
        });

        return asset ?? null;
    }

    async getObject(key: string): Promise<Buffer | null> {
        try {
            return await this.objectStorage.get(key);
        } catch {
            // A missing variant is the normal path on first request, not an
            // error worth propagating — the caller regenerates it.
            return null;
        }
    }

    async putObject(
        key: string,
        body: Buffer,
        contentType: string,
    ): Promise<void> {
        await this.objectStorage.put(key, body, { contentType });
    }

    async listAssets(options?: {
        uploadedById?: string;
        limit?: number;
        offset?: number;
    }): Promise<schema.Asset[]> {
        return await this.db.query.asset.findMany({
            where: options?.uploadedById
                ? eq(schema.asset.uploadedById, options.uploadedById)
                : undefined,
            limit: options?.limit ?? 100,
            offset: options?.offset ?? 0,
            orderBy: (asset, { desc }) => [desc(asset.createdAt)],
        });
    }

    async promoteAsset(key: string): Promise<schema.Asset | null> {
        const [updated] = await this.db
            .update(schema.asset)
            .set({
                status: "ready",
                promotedAt: new Date(),
                updatedAt: new Date(),
            })
            .where(eq(schema.asset.key, key))
            .returning();

        return updated ?? null;
    }

    async setAssetVisibility(
        key: string,
        visibility: "public" | "private",
    ): Promise<schema.Asset | null> {
        const [updated] = await this.db
            .update(schema.asset)
            .set({ visibility, updatedAt: new Date() })
            .where(eq(schema.asset.key, key))
            .returning();

        return updated ?? null;
    }
}

export async function createStorageClient(options: {
    db: NodePgDatabase<DbSchema>;
}): Promise<AssetStorageService> {
    //
    // TODO: Remove R2 Storage once drift servers are up
    //
    const [drift, r2] = await Promise.all([
        S3ObjectStorageService.create({
            endpoint: env.S3_ENDPOINT,
            accessKeyId: env.S3_ACCESS_KEY_ID,
            secretAccessKey: env.S3_SECRET_ACCESS_KEY,
            bucketName: env.S3_BUCKET_NAME,
            region: env.S3_REGION,
            useSSL: env.S3_USE_SSL,
            forcePathStyle: env.S3_FORCE_PATH_STYLE,
        }),
        S3ObjectStorageService.create({
            endpoint: env.R2_ENDPOINT,
            accessKeyId: env.R2_ACCESS_KEY_ID,
            secretAccessKey: env.R2_SECRET_ACCESS_KEY,
            bucketName: env.R2_BUCKET_NAME,
            region: env.R2_REGION,
            useSSL: env.R2_USE_SSL,
            forcePathStyle: env.R2_FORCE_PATH_STYLE,
        }),
    ]);
    const objectStorage = new PrefixRoutedObjectStorageService(drift, r2);

    return new DatabaseAssetStorageService(objectStorage, options.db);
}

function toBuffer(body: Buffer | string): Buffer {
    return typeof body === "string" ? Buffer.from(body) : body;
}
