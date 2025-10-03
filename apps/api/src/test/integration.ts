import {
    PostgreSqlContainer,
    type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import {
    RedisContainer,
    type StartedRedisContainer,
} from "@testcontainers/redis";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { testClient } from "hono/testing";
import { Pool } from "pg";
import { test } from "vitest";
import type { AppContext } from "~/lib/ctx";
import { type App, createApp } from "..";
import { createDb } from "../db";
import { createAuth } from "../lib/auth";
import { createQueueManager } from "../lib/cache/bull";
import { createRedisClient } from "../lib/cache/redis";

/**
 * `AppContext` with added shadow variables for doing the grunt-work of running the tests
 */
type TestAppContext = AppContext & {
    /**
     * Running Redis container for direct test-container manipulation
     */
    _redisContainer: StartedRedisContainer;

    /**
     * Running Postgres container for direct test-container manipulation
     */
    _postgresContainer: StartedPostgreSqlContainer;

    /**
     * The pool instance that Drizzle uses for low level control
     */
    _postgresPool: Pool;
};

/**
 * Create a test context with mock or test container instances.
 * Override specific services as needed for different test scenarios.
 */
async function createTestAppContext(): Promise<TestAppContext> {
    // Setup Postgres
    const postgresContainer = await new PostgreSqlContainer(
        "postgres:17.6",
    ).start();
    const postgresUrl = postgresContainer.getConnectionUri();
    const postgresPool = new Pool({
        connectionString: postgresUrl,
    });

    // Migrate Postgres
    const db = createDb({ pool: postgresPool });
    await migrate(db, { migrationsFolder: "./drizzle" });

    // Setup Redis
    const redisContainer = await new RedisContainer("redis:7.4-alpine").start();
    const redisUrl = redisContainer.getConnectionUrl();
    const redis = await createRedisClient(redisUrl);

    // Setup Bull queues
    const queueManager = createQueueManager(redisUrl);

    // Setup auth
    const auth = createAuth({
        db,
        redis,
    });

    const defaultContext: AppContext = {
        db,
        queueManager,
        redis,
        auth,
    };

    return {
        ...defaultContext,
        _postgresContainer: postgresContainer,
        _redisContainer: redisContainer,
        _postgresPool: postgresPool,
    };
}

/**
 * Cleanup function to close all connections in a context.
 * Call this in afterAll hooks or when shutting down the app.
 */
async function closeTestAppContext(ctx: TestAppContext): Promise<void> {
    // Close client connections
    await ctx._postgresPool?.end();
    ctx.redis.destroy();

    // Destroy containers
    await Promise.allSettled([
        await ctx._redisContainer?.stop({ remove: true }),
        await ctx._postgresContainer?.stop({ remove: true }),
    ]);
}

/**
 * A context that is provided to all integration tests, giving access to
 * a hono client and all services used by the backend for direct access
 */
export type IntegrationTestContext = {
    client: ReturnType<typeof testClient<App>>;
} & AppContext;

/**
 * Extends the base test with an `ctx` fixture for integration testing.
 *
 * The `ctx` fixture provides:
 * - A hono client to perform requests
 * - Common services such as database and redis for direct access
 *
 * The fixture automatically handles setup and teardown:
 * - Creates a new client for each test
 * - Creates and tears down fresh services
 *
 * @example
 * integrationTest('should do something', async ({ ctx }) => {
 *   // Access services
 *   const { db, redis, queueManager, client } = ctx;
 *
 *   // Send client requests to test endpoints
 *   const response = await client.query(...);
 *
 *   // Use database
 *   const rows = await db.query(...);
 * });
 *
 * @see IntegrationTestContext
 */
export const integrationTest = test.extend<{ ctx: IntegrationTestContext }>({
    ctx: [
        // biome-ignore lint/correctness/noEmptyPattern: Destructing pattern required here but is empty
        async ({}, use) => {
            // Setup
            const ctx = await createTestAppContext();
            const app = await createApp({ ctx });
            const client = testClient(app);

            // Execute
            await use({
                ...ctx,
                client,
            });

            // Cleanup
            await closeTestAppContext(ctx);
        },
        { scope: "test", auto: true },
    ],
});
