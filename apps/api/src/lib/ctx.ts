import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createDb, type DbSchema } from "~/db";
import { createQueueManager, type BullQueueManager } from "./cache/bull";
import { createRedisClient, type RedisClient } from "./cache/redis";
import { env } from "./env";
import { createAuth, type AuthInstance } from "./auth";

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
    queueManager: BullQueueManager;
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
    const queueManager = createQueueManager(env.REDIS_URL);
    const auth = createAuth({ db, redis });

    return {
        db,
        redis,
        queueManager,
        auth,
    };
}
