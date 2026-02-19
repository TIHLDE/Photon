import { type AuthInstance, createAuth } from "@photon/auth";
import {
    QueueManager,
    type RedisClient,
    createRedisClient,
} from "@photon/core/cache";
import { env } from "@photon/core/env";
import { type DbSchema, createDb } from "@photon/db";
import { type EmailTransporter, createEmailTransporter } from "@photon/email";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { HTTPException } from "hono/http-exception";
import { type ApiKeyService, createApiKeyService } from "./service/api-key";
import { type StorageClient, createStorageClient } from "./storage";

/**
 * Application context containing all external service dependencies.
 * This allows for dependency injection and makes testing easier.
 */
export interface AppContext {
    /** Database client instance */
    db: NodePgDatabase<DbSchema>;
    /** Redis client instance */
    redis: RedisClient;
    /** Queue manager for creating/accessing Bull queues */
    queue: QueueManager;
    /** BetterAuth instance */
    auth: AuthInstance;
    /** Email transporter instance */
    mailer: EmailTransporter;
    /** Storage bucket client instance (null if storage is unavailable) */
    bucket: StorageClient | null;
}

/**
 * Create the application context with real service instances.
 * This is used in production.
 */
export async function createAppContext(): Promise<AppContext> {
    const db = createDb({ connectionString: env.DATABASE_URL });
    const redis = await createRedisClient(env.REDIS_URL);
    const queue = new QueueManager(env.REDIS_URL);
    const mailer = createEmailTransporter();
    let bucket: StorageClient | null = null;
    bucket = await createStorageClient({ db });

    const auth = createAuth({ db, redis, mailer, queue, bucket });

    return {
        db,
        redis,
        queue,
        auth,
        mailer,
        bucket,
    };
}

/**
 * Get the storage bucket from context, or throw HTTP 500 if unavailable.
 * Use this in routes that require file storage.
 */
export function requireBucket(ctx: AppContext): StorageClient {
    if (!ctx.bucket) {
        throw new HTTPException(500, {
            message: "File storage is not available",
        });
    }
    return ctx.bucket;
}

export interface AppServices {
    apiKey: ApiKeyService;
}

export function createAppServices(ctx: AppContext): AppServices {
    return {
        apiKey: createApiKeyService(ctx),
    };
}
