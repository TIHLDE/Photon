import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { DbSchema } from "~/db";
import type { QueueLike } from "./cache/bull";
import type { RedisClientType } from "./cache/redis";

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
    queueManager: QueueManager;
}

export interface QueueManager {
    getQueue<T = unknown, R = unknown>(name: string): QueueLike<T, R>;
    closeAll(): Promise<void>;
}

/**
 * Create the application context with real service instances.
 * This is used in production.
 */
export async function createAppContext(config: {
    databaseUrl: string;
    redisUrl: string;
}): Promise<AppContext> {
    const { createDb } = await import("~/db");
    const { createRedisClient } = await import("./cache/redis");
    const { createQueueManager } = await import("./cache/bull");

    const db = createDb(config.databaseUrl);
    const redis = await createRedisClient(config.redisUrl);
    const queueManager = createQueueManager(config.redisUrl);

    return {
        db,
        redis,
        queueManager,
    };
}

/**
 * Create a test context with mock or test container instances.
 * Override specific services as needed for different test scenarios.
 */
export async function createTestContext(
    overrides?: Partial<AppContext>,
): Promise<AppContext> {
    const { createDb } = await import("~/db");
    const { createRedisClient } = await import("./cache/redis");
    const { createQueueManager } = await import("./cache/bull");

    // Default to in-memory or test database URLs
    const testDbUrl =
        process.env.TEST_DATABASE_URL ||
        "postgresql://test:test@localhost:5432/test";
    const testRedisUrl = process.env.TEST_REDIS_URL || "redis://localhost:6379";

    const defaultContext: AppContext = {
        db: createDb(testDbUrl),
        redis: await createRedisClient(testRedisUrl),
        queueManager: createQueueManager(testRedisUrl),
    };

    return {
        ...defaultContext,
        ...overrides,
    };
}

/**
 * Cleanup function to close all connections in a context.
 * Call this in afterAll hooks or when shutting down the app.
 */
export async function closeAppContext(ctx: AppContext): Promise<void> {
    await Promise.allSettled([
        ctx.redis.quit(),
        ctx.queueManager.closeAll(),
        // Note: drizzle doesn't expose a close method on the client directly
        // You may need to access the underlying pg pool if you need to close it
    ]);
}
