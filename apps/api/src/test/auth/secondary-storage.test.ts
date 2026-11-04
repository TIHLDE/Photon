import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

/**
 * Better Auth's view of our cache, exactly as it receives it.
 *
 * The rate limiter only runs in production, so nothing else in the suite
 * touches `increment` — which is how a version calling it as a bare function
 * (no `this`) would otherwise have reached production unnoticed.
 */
describe("Better Auth secondary storage", () => {
    integrationTest(
        "works when its methods are called detached from the object",
        async ({ ctx }) => {
            const storage = ctx.auth.options.secondaryStorage;
            if (!storage)
                throw new Error("secondary storage is not configured");

            // The 1.7 rate limiter reads the method into a variable first.
            const { increment, getAndDelete, set } = storage;

            expect(await increment("detached:counter", 10)).toBe(1);
            expect(await increment("detached:counter", 10)).toBe(2);

            await set("detached:value", "secret");
            expect(await getAndDelete("detached:value")).toBe("secret");
            expect(await getAndDelete("detached:value")).toBeUndefined();
        },
    );

    integrationTest(
        "hands a value to only one of several concurrent readers",
        async ({ ctx }) => {
            const storage = ctx.auth.options.secondaryStorage!;
            await storage.set("race:value", "secret");

            const results = await Promise.all(
                Array.from({ length: 8 }, () =>
                    storage.getAndDelete("race:value"),
                ),
            );

            expect(results.filter((r) => r === "secret")).toHaveLength(1);
        },
    );

    integrationTest("counts every concurrent increment", async ({ ctx }) => {
        const storage = ctx.auth.options.secondaryStorage!;

        const counts = await Promise.all(
            Array.from({ length: 8 }, () =>
                storage.increment("race:count", 10),
            ),
        );

        expect([...counts].sort((a, b) => a - b)).toEqual([
            1, 2, 3, 4, 5, 6, 7, 8,
        ]);
    });

    integrationTest(
        "starts a new count over a rate-limit entry left by 1.6",
        async ({ ctx }) => {
            const storage = ctx.auth.options.secondaryStorage!;
            // 1.6 stored the whole window as JSON under the same key.
            await storage.set(
                "legacy:count",
                JSON.stringify({
                    key: "legacy:count",
                    count: 3,
                    lastRequest: 0,
                }),
                10,
            );

            expect(await storage.increment("legacy:count", 10)).toBe(1);
            expect(await storage.increment("legacy:count", 10)).toBe(2);
        },
    );
});
