import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { type DbSchema, schema } from "@photon/db";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { test } from "vitest";
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
     * Running in-memory PGlite database for this test.
     */
    _pglite: PGlite;
};

/**
 * Cache key version for the migrated PGlite baseline format.
 * Increment this if the PGlite setup logic changes in a way that should rebuild
 * the cached baseline even when migration files are unchanged.
 */
const PGLITE_BASELINE_CACHE_VERSION = "v1";

const migrationsFolder = resolve(process.cwd(), "../../packages/db/drizzle");

async function getMigratedBaselinePath(): Promise<string> {
    const hash = createHash("sha256");
    hash.update(PGLITE_BASELINE_CACHE_VERSION);

    const entries = await readdir(migrationsFolder, { withFileTypes: true });
    const migrationFiles = entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
        .map((entry) => entry.name)
        .sort();

    for (const file of migrationFiles) {
        hash.update(file);
        hash.update(await readFile(join(migrationsFolder, file)));
    }

    const baselineDir = join(tmpdir(), "photon-api-pglite");
    const baselinePath = join(baselineDir, `${hash.digest("hex")}.tar`);

    try {
        await readFile(baselinePath);
        return baselinePath;
    } catch {
        await mkdir(baselineDir, { recursive: true });
    }

    const pglite = new PGlite();
    try {
        const db = drizzle({
            client: pglite,
            casing: "snake_case",
            schema,
        });

        await migrate(db, { migrationsFolder });

        const baseline = await pglite.dumpDataDir();
        const baselineBuffer = Buffer.from(await baseline.arrayBuffer());
        const temporaryPath = `${baselinePath}.${process.pid}.tmp`;

        await writeFile(temporaryPath, baselineBuffer);
        await rename(temporaryPath, baselinePath);

        return baselinePath;
    } finally {
        await pglite.close();
    }
}

/**
 * Creates a fresh in-memory PGlite database from the migrated baseline.
 *
 * Each test gets its own database instance, so database writes cannot leak
 * between tests. The baseline is cached on disk and is invalidated whenever
 * migration SQL changes.
 */
async function createTestAppContext(): Promise<TestAppContext> {
    const baselinePath = await getMigratedBaselinePath();
    const baselineBuffer = await readFile(baselinePath);
    const pglite = new PGlite({
        loadDataDir: new Blob([new Uint8Array(baselineBuffer)]),
    });

    await pglite.waitReady;

    const db = drizzle({
        client: pglite,
        casing: "snake_case",
        schema,
    });

    const defaultContext = await createBaseTestAppContext({
        db: db as unknown as NodePgDatabase<DbSchema>,
    });

    return {
        ...defaultContext,
        _pglite: pglite,
    };
}

/**
 * Cleanup function to close the in-memory database for a test.
 */
async function closeTestAppContext(ctx: TestAppContext): Promise<void> {
    await ctx._pglite.close();
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
 * Extends the base test with a fresh in-memory PGlite database and fresh
 * app services per test.
 *
 * The `ctx` fixture provides:
 * - A hono app instance to perform requests
 * - Common services such as database, cache, queue, email, and storage
 * - Test utilities for common operations
 *
 * Setup and teardown behavior:
 * - once per migration set: Builds a migrated PGlite baseline in tmpdir
 * - beforeEach: Creates a fresh in-memory PGlite database from that baseline
 * - afterEach: Closes the PGlite database
 *
 * This approach keeps test isolation while avoiding Docker/Testcontainers in
 * the default integration suite:
 * - Each test gets a separate database instance
 * - The migrated baseline is reused instead of re-running migrations
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
            const testContext = await createTestAppContext();

            const app = await createApp({
                ctx: testContext,
                service: createAppServices(testContext),
            });

            try {
                await use({
                    ...testContext,
                    app,
                    utils: createTestUtils({ ...testContext, app }),
                });
            } finally {
                await closeTestAppContext(testContext);
            }
        },
        { scope: "test", auto: true },
    ],
});
