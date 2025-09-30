import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
    setupTestContext,
    cleanupTestContext,
    getTestContext,
    flushRedis,
} from "./setup";
import { schema } from "~/db";

/**
 * Example test file demonstrating how to use the new dependency injection pattern.
 *
 * Key benefits:
 * - Tests use isolated service instances (db, redis, queues)
 * - Can easily swap implementations (e.g., mock Redis)
 * - No global state pollution between test files
 * - Tests can run in parallel safely
 */
describe("Example Test with DI", () => {
    // Setup test context once before all tests in this suite
    beforeAll(async () => {
        await setupTestContext();
    });

    // Cleanup after all tests
    afterAll(async () => {
        await cleanupTestContext();
    });

    // Optional: Clear Redis cache before each test
    beforeEach(async () => {
        const ctx = getTestContext();
        await flushRedis(ctx);
    });

    it("should query database using injected db instance", async () => {
        const ctx = getTestContext();

        // Use the test database instance
        const users = await ctx.db.select().from(schema.user).limit(10);

        expect(Array.isArray(users)).toBe(true);
    });

    it("should use Redis cache", async () => {
        const ctx = getTestContext();

        // Use the test Redis instance
        await ctx.redis.set("test-key", "test-value");
        const value = await ctx.redis.get("test-key");

        expect(value).toBe("test-value");
    });

    it("should use queue manager", async () => {
        const ctx = getTestContext();

        // Use the test queue manager
        const queue = ctx.queueManager.getQueue("test-queue");

        expect(queue).toBeDefined();
        expect(typeof queue.add).toBe("function");
    });
});

/**
 * Example test with custom context overrides.
 * You can provide mock implementations for specific services.
 */
describe("Example Test with Mocks", () => {
    beforeAll(async () => {
        // You can provide custom mock instances here
        await setupTestContext({
            // For example, if you want to mock Redis:
            // redis: createMockRedis(),
        });
    });

    afterAll(async () => {
        await cleanupTestContext();
    });

    it("should work with custom context", async () => {
        const ctx = getTestContext();
        // Your test here
        expect(ctx).toBeDefined();
    });
});
