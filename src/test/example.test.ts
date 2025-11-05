import { expect } from "vitest";
import { schema } from "~/db";
import { integrationTest } from "./config/integration";

integrationTest(
    "Test that dependencies are working",
    async ({ ctx }) => {
        // Use the test database instance
        const users = await ctx.db.select().from(schema.user).limit(10);

        expect(Array.isArray(users)).toBe(true);

        // Use the test Redis instance
        await ctx.redis.set("test-key", "test-value");
        const value = await ctx.redis.get("test-key");

        expect(value).toBe("test-value");

        // Use the test queue manager
        const queue = ctx.queue.getQueue("registration");

        expect(queue).toBeDefined();
        expect(typeof queue.add).toBe("function");
    },
    500_000,
);
