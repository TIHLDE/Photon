import { createAuth } from "@photon/auth/server";
import { createDb } from "@photon/db";
import {
    MinioContainer,
    type StartedMinioContainer,
} from "@testcontainers/minio";
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
import { afterAll, test } from "vitest";
import { createApp } from "~/index";
import { createRedisClient } from "~/lib/cache/redis";
import { type AppContext, createAppServices } from "~/lib/ctx";
import { createStorageClient } from "~/lib/storage";
import { QueueManager } from "../../../lib/cache/queue";
import { createTestUtils } from "./util";

/**
 * `AppContext` with added shadow variables for doing the grunt-work of running the tests
 */
export type TestAppContext = AppContext & {
    /**
     * Running Redis container for direct test-container manipulation
     */
    _redisContainer: StartedRedisContainer;

    /**
     * Running Postgres container for direct test-container manipulation
     */
    _postgresContainer: StartedPostgreSqlContainer;

    /**
     * Running MinIO container for direct test-container manipulation
     */
    _minioContainer: StartedMinioContainer;

    /**
     * The pool instance that Drizzle uses for low level control
     */
    _postgresPool: Pool;
};

/**
 * File-scoped shared test context and containers.
 * These are initialized once per test file in beforeAll.
 *
 * IMPORTANT: This approach relies on Vitest's default thread pool behavior where
 * each test file runs in its own worker thread with isolated module scope.
 * If you change Vitest config to use `fileParallelism: false` or `singleThread: true`,
 * test files may share this variable causing conflicts. In that case, refactor to use
 * WeakMap or suite-level hooks instead.
 */
let sharedTestContext: TestAppContext | null = null;

const POSTGRES_AFTER_MIGRATION_SNAPSHOT_NAME = "after-migration";

async function createPostgres() {
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

    // Close pool before taking snapshot to avoid "database is being accessed" error
    await postgresPool.end();
    await postgresContainer.snapshot(POSTGRES_AFTER_MIGRATION_SNAPSHOT_NAME);

    // Reconnect after snapshot
    const newPool = new Pool({ connectionString: postgresUrl });
    const newDb = createDb({ pool: newPool });

    return {
        container: postgresContainer,
        pool: newPool,
        db: newDb,
    };
}

async function createRedis() {
    // Setup Redis
    const redisContainer = await new RedisContainer("redis:7.4-alpine").start();
    const redisUrl = redisContainer.getConnectionUrl();
    const redis = await createRedisClient(redisUrl);

    return {
        container: redisContainer,
        redis,
        redisUrl,
    };
}

async function createMinio() {
    // Setup MinIO
    const minioContainer = await new MinioContainer(
        "minio/minio:latest",
    ).start();

    return {
        container: minioContainer,
        endpoint: `${minioContainer.getHost()}:${minioContainer.getPort()}`,
        accessKeyId: minioContainer.getUsername(),
        secretAccessKey: minioContainer.getPassword(),
    };
}

/**
 * Create a test context with test container instances.
 * This should be called once per test file in beforeAll.
 */
async function createTestAppContext(): Promise<TestAppContext> {
    const [postgresVals, redisVals, minioVals] = await Promise.all([
        createPostgres(),
        createRedis(),
        createMinio(),
    ]);
    const {
        container: postgresContainer,
        pool: newPool,
        db: newDb,
    } = postgresVals;
    const { container: redisContainer, redis, redisUrl } = redisVals;
    const {
        container: minioContainer,
        endpoint,
        accessKeyId,
        secretAccessKey,
    } = minioVals;

    // Create storage client with database for file tracking
    const bucket = await createStorageClient({
        endpoint,
        accessKeyId,
        secretAccessKey,
        bucketName: "test-bucket",
        useSSL: false,
        db: newDb,
    });

    // Setup Bull queues
    const queue = new QueueManager(redisUrl);

    // Setup auth
    const auth = createAuth({
        db: newDb,
        redis,
        baseURL: "http://localhost:4000",
        feide: { clientId: "test", clientSecret: "test" },
        isProduction: false,
        trustedOrigins: ["http://localhost:3000"],
    });

    const defaultContext: AppContext = {
        db: newDb,
        queue,
        redis,
        auth,
        mailer: undefined, // No email sending in tests
        bucket,
    };

    return {
        ...defaultContext,
        _postgresContainer: postgresContainer,
        _redisContainer: redisContainer,
        _minioContainer: minioContainer,
        _postgresPool: newPool,
    };
}

/**
 * Reset the database by truncating all tables.
 * Call this in beforeEach to ensure a fresh DB for each test.
 */
async function resetDatabase(ctx: TestAppContext): Promise<void> {
    // Close existing connections before restoring snapshot
    await ctx._postgresPool.end();

    // Restore snapshot
    await ctx._postgresContainer.restoreSnapshot(
        POSTGRES_AFTER_MIGRATION_SNAPSHOT_NAME,
    );

    // Reconnect with new pool
    const postgresUrl = ctx._postgresContainer.getConnectionUri();
    const newPool = new Pool({ connectionString: postgresUrl });
    ctx._postgresPool = newPool;

    // Recreate db instance
    const newDb = createDb({ pool: newPool });
    ctx.db = newDb;

    // Recreate auth with new db
    ctx.auth = createAuth({
        db: newDb,
        redis: ctx.redis,
        baseURL: "http://localhost:4000",
        feide: { clientId: "test", clientSecret: "test" },
        isProduction: false,
        trustedOrigins: ["http://localhost:3000"],
    });
}

/**
 * Flush all Redis data.
 * Call this in beforeEach to ensure a fresh Redis for each test.
 */
async function resetRedis(ctx: TestAppContext): Promise<void> {
    await ctx.redis.flushAll();
}

/**
 * Reset MinIO bucket by recreating the storage client with a fresh bucket.
 * Call this in beforeEach to ensure a fresh bucket for each test.
 */
async function resetBucket(ctx: TestAppContext): Promise<void> {
    // For now, we'll just recreate the bucket client
    // In the future, we could delete all objects in the bucket
    const endpoint = `${ctx._minioContainer.getHost()}:${ctx._minioContainer.getPort()}`;
    const accessKeyId = ctx._minioContainer.getUsername();
    const secretAccessKey = ctx._minioContainer.getPassword();

    ctx.bucket = await createStorageClient({
        endpoint,
        accessKeyId,
        secretAccessKey,
        bucketName: "test-bucket",
        useSSL: false,
        db: ctx.db,
    });
}

/**
 * Cleanup function to close all connections and stop containers.
 * Call this in afterAll hooks when shutting down the test file.
 */
async function closeTestAppContext(ctx: TestAppContext): Promise<void> {
    // Close client connections
    await ctx._postgresPool!.end();
    ctx.redis.destroy();

    // Destroy containers
    await Promise.all([
        ctx._redisContainer!.stop({ remove: true, timeout: 1000 }),
        ctx._postgresContainer!.stop({ remove: true, timeout: 1000 }),
        ctx._minioContainer!.stop({ remove: true, timeout: 1000 }),
    ]);
}

/**
 * A context that is provided to all integration tests, giving access to
 * a hono client and all services used by the backend for direct access
 */
export type IntegrationTestContext = {
    app: Awaited<ReturnType<typeof createApp>>;
    utils: ReturnType<typeof createTestUtils>;
} & AppContext;

/**
 * Extends the base test with file-scoped test containers and per-test database/Redis reset.
 *
 * The `ctx` fixture provides:
 * - A hono app instance to perform requests
 * - Common services such as database and redis for direct access
 * - Test utilities for common operations
 *
 * Setup and teardown behavior:
 * - beforeAll: Creates containers once per test file (Postgres + Redis)
 * - beforeEach: Truncates all tables and flushes Redis
 * - afterAll: Stops containers and closes connections
 *
 * This approach significantly improves performance by:
 * - Reusing containers across tests in the same file
 * - Truncating tables instead of re-migrating
 * - Only flushing Redis instead of recreating containers
 *
 * @example
 * integrationTest.describe('My feature', () => {
 *   integrationTest('should do something', async ({ ctx }) => {
 *     const { db, redis, app, utils } = ctx;
 *
 *     // Test with fresh database state
 *     const response = await utils.client.get('/api/endpoint');
 *   });
 * });
 *
 * @see IntegrationTestContext
 */
export const integrationTest = test.extend<{ ctx: IntegrationTestContext }>({
    ctx: [
        // biome-ignore lint/correctness/noEmptyPattern: Destructing pattern required here but is empty
        async ({}, use) => {
            // Initialize shared context once per file
            if (!sharedTestContext) {
                sharedTestContext = await createTestAppContext();
            }

            // Create fresh app instance for this test
            const app = await createApp({
                ctx: sharedTestContext,
                service: createAppServices(sharedTestContext),
            });

            // Execute test
            await use({
                ...sharedTestContext,
                app,
                utils: createTestUtils({ ...sharedTestContext, app }),
            });

            // Reset state before each test
            await resetDatabase(sharedTestContext);
            await resetRedis(sharedTestContext);
            await resetBucket(sharedTestContext);
        },
        { scope: "test", auto: true },
    ],
});

// Setup afterAll cleanup hook
afterAll(async () => {
    if (sharedTestContext) {
        await closeTestAppContext(sharedTestContext);
        sharedTestContext = null;
    }
});
