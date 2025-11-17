import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { type DbSchema, createDb } from "~/db";
import { type AuthInstance, createAuth } from "./auth";
import { QueueManager } from "./cache/queue";
import { type RedisClient, createRedisClient } from "./cache/redis";
import { type EmailTransporter, createEmailTransporter } from "./email";
import { env } from "./env";
import { type ApiKeyService, createApiKeyService } from "./service/api-key";

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
    const auth = createAuth({ db, redis, mailer, queue });

    return {
        db,
        redis,
        queue,
        auth,
        mailer,
    };
}

export interface AppServices {
    apiKey: ApiKeyService;
}

export function createAppServices(ctx: AppContext): AppServices {
    return {
        apiKey: createApiKeyService(ctx),
    };
}
