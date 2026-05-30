import { createDb } from "@photon/db";
import {
    PostgreSqlContainer,
    type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { afterAll, test } from "vitest";
import { createApp } from "~/index";
import {
    type AppContext,
    createAppServices,
    createTestAppContext as createBaseTestAppContext,
} from "~/lib/ctx";
import { createTestUtils } from "./util";

/**
 * `AppContext` with added shadow variables for doing the grunt-work of running the tests
 */
export type TestAppContext = AppContext & {
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
    // TODO(PGLite): Replace this function with a PGLite-backed DbSchema
    // instance and remove the remaining testcontainer dependency.
    const postgresContainer = await new PostgreSqlContainer(
        "postgres:17.6",
    ).start();
    const postgresUrl = postgresContainer.getConnectionUri();
    const postgresPool = new Pool({
        connectionString: postgresUrl,
    });

    // Migrate Postgres
    const db = createDb({ pool: postgresPool });
    await migrate(db, { migrationsFolder: "../../packages/db/drizzle" });

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

/**
 * Create a test context with test container instances.
 * This should be called once per test file in beforeAll.
 */
async function createTestAppContext(): Promise<TestAppContext> {
    const postgresVals = await createPostgres();
    const {
        container: postgresContainer,
        pool: newPool,
        db: newDb,
    } = postgresVals;
    const defaultContext = await createBaseTestAppContext({ db: newDb });

    return {
        ...defaultContext,
        _postgresContainer: postgresContainer,
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
    const refreshedContext = await createBaseTestAppContext({ db: newDb });
    Object.assign(ctx, refreshedContext);
}

/**
 * Cleanup function to close all connections and stop containers.
 * Call this in afterAll hooks when shutting down the test file.
 */
async function closeTestAppContext(ctx: TestAppContext): Promise<void> {
    // Close client connections
    await ctx._postgresPool?.end();

    // Destroy containers
    await Promise.all([
        ctx._postgresContainer?.stop({ remove: true, timeout: 1000 }),
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
 * Extends the base test with a file-scoped Postgres testcontainer and
 * per-test service reset.
 *
 * The `ctx` fixture provides:
 * - A hono app instance to perform requests
 * - Common services such as database, cache, queue, email, and storage
 * - Test utilities for common operations
 *
 * Setup and teardown behavior:
 * - beforeAll: Creates the Postgres container once per test file
 * - beforeEach: Restores the Postgres snapshot and recreates test services
 * - afterAll: Stops the Postgres container and closes connections
 *
 * This approach significantly improves performance by:
 * - Reusing containers across tests in the same file
 * - Truncating tables instead of re-migrating
 * - Using in-memory services for cache, queue, email, and storage
 *
 * @example
 * integrationTest.describe('My feature', () => {
 *   integrationTest('should do something', async ({ ctx }) => {
 *     const { db, cache, app, utils } = ctx;
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
