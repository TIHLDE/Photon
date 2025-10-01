import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { DbSchema } from "~/db";
import type { BullQueueManager, QueueLike } from "./cache/bull";
import type { RedisClientType } from "./cache/redis";
import { env } from "./env";
import {
    PostgreSqlContainer,
    type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import {
    RedisContainer,
    type StartedRedisContainer,
} from "@testcontainers/redis";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

/**
 * Application context containing all external service dependencies.
 * This allows for dependency injection and makes testing easier.
 */
export interface AppContext {
    /** Database client instance */
    db: NodePgDatabase<DbSchema>;
    /** Redis client instance */
    redis: RedisClientType;
    /** Queue manager for creating/accessing Bull queues */
    queueManager: BullQueueManager;
}

/**
 * Create the application context with real service instances.
 * This is used in production.
 */
export async function createAppContext(): Promise<AppContext> {
    const { createDb } = await import("~/db");
    const { createRedisClient } = await import("./cache/redis");
    const { createQueueManager } = await import("./cache/bull");

    const db = createDb({ connectionString: env.DATABASE_URL });
    const redis = await createRedisClient(env.REDIS_URL);
    const queueManager = createQueueManager(env.REDIS_URL);

    return {
        db,
        redis,
        queueManager,
    };
}
