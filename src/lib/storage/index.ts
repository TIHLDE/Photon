import {
    CreateBucketCommand,
    DeleteObjectCommand,
    GetObjectCommand,
    HeadBucketCommand,
    PutObjectCommand,
    S3Client,
    type S3ClientConfig,
} from "@aws-sdk/client-s3";
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { type DbSchema, schema } from "~/db";
import { env } from "~/lib/env";

/**
 * Metadata for file uploads
 */
export interface UploadMetadata {
    /**
     * Original filename
     */
    originalFilename: string;

    /**
     * MIME type (e.g., 'image/jpeg')
     */
    contentType?: string;

    /**
     * ID of the user uploading the file (optional)
     */
    uploadedById?: string;
}

/**
 * Storage client interface for file operations
 */
export interface StorageClient {
    /**
     * The underlying S3 client instance
     */
    client: S3Client;

    /**
     * The bucket name being used
     */
    bucketName: string;

    /**
     * Upload a file to the storage bucket and track it in the database
     * @param key - The file key/path in the bucket
     * @param body - The file content as Buffer or string
     * @param metadata - File metadata (originalFilename, contentType, uploadedById)
     * @returns The uploaded file's key
     */
    upload: (
        key: string,
        body: Buffer | string,
        metadata: UploadMetadata,
    ) => Promise<string>;

    /**
     * Download a file from the storage bucket
     * @param key - The file key/path in the bucket
     * @returns The file content as Buffer
     */
    download: (key: string) => Promise<Buffer>;

    /**
     * Delete a file from the storage bucket and remove it from the database
     * @param key - The file key/path in the bucket
     */
    delete: (key: string) => Promise<void>;

    /**
     * Check if a file exists in the storage bucket
     * @param key - The file key/path in the bucket
     * @returns True if the file exists, false otherwise
     */
    exists: (key: string) => Promise<boolean>;

    /**
     * Get asset metadata from the database
     * @param key - The file key/path in the bucket
     * @returns Asset metadata or null if not found
     */
    getAsset: (key: string) => Promise<schema.Asset | null>;

    /**
     * List all assets in the database
     * @param options - Optional filtering and pagination options
     * @returns Array of assets
     */
    listAssets: (options?: {
        uploadedById?: string;
        limit?: number;
        offset?: number;
    }) => Promise<schema.Asset[]>;
}

/**
 * Create an S3-compatible storage client (MinIO for dev, OpenStack Swift for prod)
 * @param options - Configuration options
 * @returns Storage client instance
 */
export async function createStorageClient(options?: {
    endpoint?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    bucketName?: string;
    region?: string;
    useSSL?: boolean;
    forcePathStyle?: boolean;
    db?: NodePgDatabase<DbSchema>;
}): Promise<StorageClient> {
    const endpoint = options?.endpoint || env.S3_ENDPOINT;
    const accessKeyId = options?.accessKeyId || env.S3_ACCESS_KEY_ID;
    const secretAccessKey =
        options?.secretAccessKey || env.S3_SECRET_ACCESS_KEY;
    const bucketName = options?.bucketName || env.S3_BUCKET_NAME;
    const region = options?.region || env.S3_REGION;
    const useSSL = options?.useSSL ?? env.S3_USE_SSL;
    const forcePathStyle = options?.forcePathStyle ?? env.S3_FORCE_PATH_STYLE;
    const db = options?.db;

    const config: S3ClientConfig = {
        endpoint: `${useSSL ? "https" : "http"}://${endpoint}`,
        region,
        credentials: {
            accessKeyId,
            secretAccessKey,
        },
        forcePathStyle,
    };

    const client = new S3Client(config);

    // Ensure bucket exists
    await ensureBucketExists(client, bucketName);

    // Helper function to upload files
    const upload = async (
        key: string,
        body: Buffer | string,
        metadata: UploadMetadata,
    ): Promise<string> => {
        const bodyBuffer = typeof body === "string" ? Buffer.from(body) : body;

        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            Body: bodyBuffer,
            ContentType: metadata.contentType,
        });

        await client.send(command);

        // Track in database if db instance is provided
        if (db) {
            await db
                .insert(schema.asset)
                .values({
                    key,
                    originalFilename: metadata.originalFilename,
                    contentType: metadata.contentType,
                    size: bodyBuffer.length,
                    uploadedById: metadata.uploadedById,
                })
                .onConflictDoUpdate({
                    target: schema.asset.key,
                    set: {
                        originalFilename: metadata.originalFilename,
                        contentType: metadata.contentType,
                        size: bodyBuffer.length,
                        uploadedById: metadata.uploadedById,
                        updatedAt: new Date(),
                    },
                });
        }

        return key;
    };

    // Helper function to download files
    const download = async (key: string): Promise<Buffer> => {
        const command = new GetObjectCommand({
            Bucket: bucketName,
            Key: key,
        });

        const response = await client.send(command);
        const stream = response.Body;

        if (!stream) {
            throw new Error(`File not found: ${key}`);
        }

        // Convert stream to buffer
        const chunks: Uint8Array[] = [];
        for await (const chunk of stream as AsyncIterable<Uint8Array>) {
            chunks.push(chunk);
        }

        return Buffer.concat(chunks);
    };

    // Helper function to delete files
    const deleteFile = async (key: string): Promise<void> => {
        const command = new DeleteObjectCommand({
            Bucket: bucketName,
            Key: key,
        });

        await client.send(command);

        // Remove from database if db instance is provided
        if (db) {
            await db.delete(schema.asset).where(eq(schema.asset.key, key));
        }
    };

    // Helper function to check if file exists
    const exists = async (key: string): Promise<boolean> => {
        try {
            const command = new GetObjectCommand({
                Bucket: bucketName,
                Key: key,
            });

            await client.send(command);
            return true;
        } catch (error) {
            return false;
        }
    };

    // Helper function to get asset metadata from database
    const getAsset = async (key: string): Promise<schema.Asset | null> => {
        if (!db) {
            throw new Error(
                "Database instance required for getAsset operation",
            );
        }

        const asset = await db.query.asset.findFirst({
            where: eq(schema.asset.key, key),
        });

        return asset ?? null;
    };

    // Helper function to list assets from database
    const listAssets = async (options?: {
        uploadedById?: string;
        limit?: number;
        offset?: number;
    }): Promise<schema.Asset[]> => {
        if (!db) {
            throw new Error(
                "Database instance required for listAssets operation",
            );
        }

        const query = db.query.asset.findMany({
            where: options?.uploadedById
                ? eq(schema.asset.uploadedById, options.uploadedById)
                : undefined,
            limit: options?.limit ?? 100,
            offset: options?.offset ?? 0,
            orderBy: (asset, { desc }) => [desc(asset.createdAt)],
        });

        return await query;
    };

    return {
        client,
        bucketName,
        upload,
        download,
        delete: deleteFile,
        exists,
        getAsset,
        listAssets,
    };
}

/**
 * Ensure a bucket exists, create it if it doesn't
 */
async function ensureBucketExists(
    client: S3Client,
    bucketName: string,
): Promise<void> {
    try {
        // Check if bucket exists
        const headCommand = new HeadBucketCommand({ Bucket: bucketName });
        await client.send(headCommand);
    } catch (error) {
        // Bucket doesn't exist, create it
        const createCommand = new CreateBucketCommand({ Bucket: bucketName });
        await client.send(createCommand);
        console.log(`✅ Created S3 bucket: ${bucketName}`);
    }
}
