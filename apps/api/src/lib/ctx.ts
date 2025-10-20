import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { type DbSchema, createDb } from "~/db";
import { type AuthInstance, createAuth } from "./auth";
import { QueueManager } from "./cache/queue";
import { type RedisClient, createRedisClient } from "./cache/redis";
import { env } from "./env";

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
}

/**
 * Create the application context with real service instances.
 * This is used in production.
 */
export async function createAppContext(): Promise<AppContext> {
    const db = createDb({ connectionString: env.DATABASE_URL });
    const redis = await createRedisClient(env.REDIS_URL);
    const auth = createAuth({ db, redis });
    const queue = new QueueManager(env.REDIS_URL);

    return {
        db,
        redis,
        queue,
        auth,
    };
}
