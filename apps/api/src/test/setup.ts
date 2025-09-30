import { afterAll, afterEach, beforeAll } from "vitest";
import type { AppContext } from "~/lib/context";
import { closeAppContext, createTestContext } from "~/lib/context";

/**
 * Global test context that can be used across all tests.
 * Initialize this in your test setup files.
 */
let testContext: AppContext | null = null;

/**
 * Get the current test context.
 * Throws an error if context hasn't been initialized.
 */
export function getTestContext(): AppContext {
    if (!testContext) {
        throw new Error(
            "Test context not initialized. Call setupTestContext() in beforeAll hook.",
        );
    }
    return testContext;
}

/**
 * Setup function to initialize test context before running tests.
 * Call this in a beforeAll hook in your test file.
 *
 * @example
 * ```ts
 * import { setupTestContext, cleanupTestContext } from "~/test/setup";
 *
 * beforeAll(async () => {
 *   await setupTestContext();
 * });
 *
 * afterAll(async () => {
 *   await cleanupTestContext();
 * });
 * ```
 */
export async function setupTestContext(
    overrides?: Partial<AppContext>,
): Promise<AppContext> {
    testContext = await createTestContext(overrides);
    return testContext;
}

/**
 * Cleanup function to close all connections and clean up resources.
 * Call this in an afterAll hook in your test file.
 */
export async function cleanupTestContext(): Promise<void> {
    if (testContext) {
        await closeAppContext(testContext);
        testContext = null;
    }
}

/**
 * Helper to reset database state between tests.
 * You may want to implement this based on your specific needs
 * (e.g., truncate tables, run migrations, etc.)
 */
export async function resetDatabase(ctx: AppContext): Promise<void> {
    // TODO: Implement database reset logic
    // For example:
    // await ctx.db.execute(sql`TRUNCATE TABLE ...`);
    // Or use a library like drizzle-kit to reset schema
}

/**
 * Helper to flush Redis cache between tests.
 */
export async function flushRedis(ctx: AppContext): Promise<void> {
    await ctx.redis.flushDb();
}
