import {
    CreateBucketCommand,
    DeleteObjectCommand,
    GetObjectCommand,
    HeadBucketCommand,
    HeadObjectCommand,
    PutObjectCommand,
    S3Client,
    type S3ClientConfig,
} from "@aws-sdk/client-s3";
import type { ObjectStorageService, StorageObjectMetadata } from "./base";

export type S3ObjectStorageServiceOptions = {
    endpoint: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucketName: string;
    region: string;
    useSSL: boolean;
    forcePathStyle: boolean;
    /** Overrides {@link DEFAULT_TIMEOUTS}. Rarely needed. */
    timeouts?: { requestMs?: number; connectionMs?: number };
};

/**
 * Without these the SDK waits forever.
 *
 * `requestTimeout` is a socket-inactivity limit, not a deadline for the whole
 * transfer, so a slow 50 MB upload is unaffected — only a connection that has
 * gone quiet is cut off. A stalled download hung a maintenance script for 51
 * minutes at 100 % CPU on 3. september 2026; the same hang inside the API
 * holds a request, and with it a database connection, open indefinitely.
 *
 * `throwOnRequestTimeout` is the half that does the work. On its own
 * `requestTimeout` only logs «a request has exceeded the configured timeout»
 * and keeps waiting — which is exactly as useless as no timeout at all, and
 * was verified against a socket that accepts and never answers.
 *
 * The SDK retries a timeout, so a connection that never answers costs up to
 * three of these before the call gives up. Minutes, not forever.
 */
const DEFAULT_TIMEOUTS = {
    requestMs: 120_000,
    connectionMs: 15_000,
} as const;

export class S3ObjectStorageService implements ObjectStorageService {
    readonly client: S3Client;
    readonly bucketName: string;

    private constructor(client: S3Client, bucketName: string) {
        this.client = client;
        this.bucketName = bucketName;
    }

    static async create(
        options: S3ObjectStorageServiceOptions,
    ): Promise<S3ObjectStorageService> {
        const config: S3ClientConfig = {
            endpoint: `${options.useSSL ? "https" : "http"}://${options.endpoint}`,
            region: options.region,
            credentials: {
                accessKeyId: options.accessKeyId,
                secretAccessKey: options.secretAccessKey,
            },
            forcePathStyle: options.forcePathStyle,
            requestHandler: {
                requestTimeout:
                    options.timeouts?.requestMs ?? DEFAULT_TIMEOUTS.requestMs,
                connectionTimeout:
                    options.timeouts?.connectionMs ??
                    DEFAULT_TIMEOUTS.connectionMs,
                throwOnRequestTimeout: true,
            },
        };

        const client = new S3Client(config);
        await ensureBucketExists(client, options.bucketName);
        return new S3ObjectStorageService(client, options.bucketName);
    }

    async put(
        key: string,
        body: Buffer | string,
        metadata?: StorageObjectMetadata,
    ): Promise<string> {
        await this.client.send(
            new PutObjectCommand({
                Bucket: this.bucketName,
                Key: key,
                Body: toBuffer(body),
                ContentType: metadata?.contentType,
            }),
        );

        return key;
    }

    async get(key: string): Promise<Buffer> {
        const response = await this.client.send(
            new GetObjectCommand({
                Bucket: this.bucketName,
                Key: key,
            }),
        );

        const stream = response.Body;
        if (!stream) {
            throw new Error(`Object not found: ${key}`);
        }

        const chunks: Uint8Array[] = [];
        for await (const chunk of stream as AsyncIterable<Uint8Array>) {
            chunks.push(chunk);
        }

        return Buffer.concat(chunks);
    }

    async delete(key: string): Promise<void> {
        await this.client.send(
            new DeleteObjectCommand({
                Bucket: this.bucketName,
                Key: key,
            }),
        );
    }

    async exists(key: string): Promise<boolean> {
        try {
            await this.client.send(
                new HeadObjectCommand({
                    Bucket: this.bucketName,
                    Key: key,
                }),
            );
            return true;
        } catch {
            return false;
        }
    }
}

function toBuffer(body: Buffer | string): Buffer {
    return typeof body === "string" ? Buffer.from(body) : body;
}

async function ensureBucketExists(
    client: S3Client,
    bucketName: string,
): Promise<void> {
    try {
        await client.send(new HeadBucketCommand({ Bucket: bucketName }));
    } catch {
        await client.send(new CreateBucketCommand({ Bucket: bucketName }));
        console.log(`✅ Created S3 bucket: ${bucketName}`);
    }
}
