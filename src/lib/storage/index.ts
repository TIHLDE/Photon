import {
    CreateBucketCommand,
    DeleteObjectCommand,
    GetObjectCommand,
    HeadBucketCommand,
    PutObjectCommand,
    S3Client,
    type S3ClientConfig,
} from "@aws-sdk/client-s3";
import { env } from "~/lib/env";

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
     * Upload a file to the storage bucket
     * @param key - The file key/path in the bucket
     * @param body - The file content as Buffer or string
     * @param contentType - Optional MIME type (e.g., 'image/jpeg')
     * @returns The uploaded file's key
     */
    upload: (
        key: string,
        body: Buffer | string,
        contentType?: string,
    ) => Promise<string>;

    /**
     * Download a file from the storage bucket
     * @param key - The file key/path in the bucket
     * @returns The file content as Buffer
     */
    download: (key: string) => Promise<Buffer>;

    /**
     * Delete a file from the storage bucket
     * @param key - The file key/path in the bucket
     */
    delete: (key: string) => Promise<void>;

    /**
     * Check if a file exists in the storage bucket
     * @param key - The file key/path in the bucket
     * @returns True if the file exists, false otherwise
     */
    exists: (key: string) => Promise<boolean>;
}

/**
 * Create a MinIO/S3 storage client
 * @param options - Configuration options
 * @returns Storage client instance
 */
export async function createStorageClient(options?: {
    endpoint?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    bucketName?: string;
    useSSL?: boolean;
}): Promise<StorageClient> {
    const endpoint = options?.endpoint || env.MINIO_ENDPOINT;
    const accessKeyId = options?.accessKeyId || env.MINIO_ROOT_USER;
    const secretAccessKey = options?.secretAccessKey || env.MINIO_ROOT_PASSWORD;
    const bucketName = options?.bucketName || env.MINIO_BUCKET_NAME;
    const useSSL = options?.useSSL ?? env.MINIO_USE_SSL;

    const config: S3ClientConfig = {
        endpoint: `${useSSL ? "https" : "http"}://${endpoint}`,
        region: "us-east-1", // MinIO doesn't use regions but S3 client requires it
        credentials: {
            accessKeyId,
            secretAccessKey,
        },
        forcePathStyle: true, // Required for MinIO
    };

    const client = new S3Client(config);

    // Ensure bucket exists
    await ensureBucketExists(client, bucketName);

    // Helper function to upload files
    const upload = async (
        key: string,
        body: Buffer | string,
        contentType?: string,
    ): Promise<string> => {
        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            Body: body,
            ContentType: contentType,
        });

        await client.send(command);
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

    return {
        client,
        bucketName,
        upload,
        download,
        delete: deleteFile,
        exists,
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
        console.log(`✅ Created MinIO bucket: ${bucketName}`);
    }
}
