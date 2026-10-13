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
 * Schema holding a copy of every row the migrations seed, so `resetDatabase`
 * can put them back after truncating.
 */
const SEED_SCHEMA = "photon_test_seed";

/**
 * A PGlite instance that lives for a whole test worker, plus the SQL that
 * returns it to the migrated baseline.
 */
type WorkerDatabase = {
    pglite: PGlite;
    /** Restores the migrated baseline: data, seeded rows and sequences. */
    reset: () => Promise<void>;
};

/**
 * Boots one PGlite from the migrated baseline and prepares a reset script.
 *
 * Booting PGlite costs ~700ms (WASM start-up plus loading the data dir), and
 * doing it per test was the bulk of the suite's runtime. Truncating and
 * re-seeding the same instance costs well under 100ms.
 *
 * The reset copies the rows the migrations seed into {@link SEED_SCHEMA} once,
 * and each reset truncates every public table, re-inserts those rows and puts
 * every sequence back where the baseline had it, so ids are as predictable
 * as on a freshly loaded database.
 */
async function createWorkerDatabase(): Promise<WorkerDatabase> {
    const baselinePath = await getMigratedBaselinePath();
    const baselineBuffer = await readFile(baselinePath);
    const pglite = new PGlite({
        loadDataDir: new Blob([new Uint8Array(baselineBuffer)]),
    });

    await pglite.waitReady;

    const { rows: tables } = await pglite.query<{ name: string }>(
        `SELECT tablename AS name FROM pg_tables
         WHERE schemaname = 'public' ORDER BY tablename`,
    );

    await pglite.exec(`CREATE SCHEMA ${SEED_SCHEMA}`);

    const restoreSeed: string[] = [];
    for (const { name } of tables) {
        const table = `"${name}"`;
        const { rows } = await pglite.query<{ seeded: boolean }>(
            `SELECT EXISTS (SELECT 1 FROM public.${table}) AS seeded`,
        );
        if (!rows[0]?.seeded) continue;

        await pglite.exec(
            `CREATE TABLE ${SEED_SCHEMA}.${table} AS TABLE public.${table}`,
        );
        restoreSeed.push(
            `INSERT INTO public.${table} OVERRIDING SYSTEM VALUE
             SELECT * FROM ${SEED_SCHEMA}.${table};`,
        );
    }

    const { rows: sequences } = await pglite.query<{
        name: string;
        lastValue: string | null;
    }>(
        `SELECT sequencename AS name, last_value::text AS "lastValue"
         FROM pg_sequences WHERE schemaname = 'public'`,
    );
    const restoreSequences = sequences.map(({ name, lastValue }) =>
        lastValue === null
            ? `ALTER SEQUENCE public."${name}" RESTART;`
            : `SELECT setval('public."${name}"', ${lastValue}, true);`,
    );

    const resetSql = [
        // Skips FK triggers so seeded rows can go back in any order.
        "SET session_replication_role = replica;",
        tables.length > 0
            ? `TRUNCATE ${tables.map(({ name }) => `public."${name}"`).join(", ")};`
            : "",
        ...restoreSeed,
        ...restoreSequences,
        "SET session_replication_role = DEFAULT;",
    ].join("\n");

    return {
        pglite,
        reset: async () => {
            await pglite.exec(resetSql);
        },
    };
}

/**
 * Builds the per-test app context on top of the worker's database.
 */
async function createTestAppContext(pglite: PGlite): Promise<TestAppContext> {
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
 * Undoes methods a test patched onto the shared PGlite instance (query
 * counters do this), in case the test failed before restoring them itself.
 * Only function-valued properties are touched; PGlite's own state is left be.
 */
function snapshotMethods(target: object): Map<PropertyKey, unknown> {
    return new Map(
        Reflect.ownKeys(target)
            .map((key) => [key, Reflect.get(target, key)] as const)
            .filter(([, value]) => typeof value === "function"),
    );
}

function restoreMethods(
    target: object,
    snapshot: Map<PropertyKey, unknown>,
): void {
    for (const key of Reflect.ownKeys(target)) {
        const value = Reflect.get(target, key);
        if (typeof value !== "function") continue;
        if (!snapshot.has(key)) {
            Reflect.deleteProperty(target, key);
        } else if (snapshot.get(key) !== value) {
            Reflect.set(target, key, snapshot.get(key));
        }
    }
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
 * Extends the base test with a clean database and fresh app services per test.
 *
 * The `ctx` fixture provides:
 * - A hono app instance to perform requests
 * - Common services such as database, cache, queue, email, and storage
 * - Test utilities for common operations
 *
 * Setup and teardown behavior:
 * - once per migration set: Builds a migrated PGlite baseline in tmpdir
 * - once per worker: Boots one in-memory PGlite from that baseline
 * - beforeEach: Resets that database to the baseline (truncate + re-seed)
 *   and builds fresh app services on top of it
 *
 * This approach keeps test isolation while avoiding Docker/Testcontainers in
 * the default integration suite:
 * - Each test starts from the same migrated state, with no rows left behind
 * - PGlite boots once per worker instead of once per test
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
export const integrationTest = test.extend<{
    ctx: IntegrationTestContext;
    workerDatabase: WorkerDatabase;
}>({
    workerDatabase: [
        // biome-ignore lint/correctness/noEmptyPattern: Destructing pattern required here but is empty
        async ({}, use) => {
            const workerDatabase = await createWorkerDatabase();
            try {
                await use(workerDatabase);
            } finally {
                await workerDatabase.pglite.close();
            }
        },
        { scope: "worker" },
    ],
    ctx: [
        async ({ workerDatabase }, use) => {
            const { pglite, reset } = workerDatabase;
            const methods = snapshotMethods(pglite);

            // Reset before rather than after, so writes a previous test left
            // in flight are wiped too.
            await reset();

            const testContext = await createTestAppContext(pglite);

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
                restoreMethods(pglite, methods);
            }
        },
        { scope: "test", auto: true },
    ],
});
