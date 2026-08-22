import { describe, expect, vi } from "vitest";
import { integrationTest } from "~/test/config/integration";

/**
 * The route exists to answer one question from outside: is the container
 * serving right now the one the deploy just built?
 *
 * Until it existed, that could only be answered by finding some schema that
 * happened to change in that release — `FeedbackItem` served as the
 * fingerprint for 2026-08-21.release-1, and 2026-08-22.release-1 had none at
 * all, so its swap could not be confirmed.
 */
describe("GET /api/version", () => {
    integrationTest("reports build metadata and uptime", async ({ ctx }) => {
        const client = ctx.utils.client();
        const res = await client.api.version.$get();

        expect(res.status).toBe(200);
        const body = await res.json();

        // The test process has nothing baked in, which is exactly the case a
        // container built outside the release pipeline is in. It must say so
        // rather than answer `undefined`.
        expect(body.version).toBe("unknown");
        expect(body.commit).toBe("unknown");

        expect(Number.isFinite(body.uptimeSeconds)).toBe(true);
        expect(body.uptimeSeconds).toBeGreaterThanOrEqual(0);
        expect(new Date(body.startedAt).getTime()).toBeLessThanOrEqual(
            Date.now(),
        );
    });

    integrationTest(
        "startedAt is the boot, not the request",
        async ({ ctx }) => {
            /**
             * The bug this guards against: reading the clock inside the
             * handler. It would look right in every single response and be
             * useless for the one thing the route is for — a `startedAt` that
             * always says "now" can never reveal a container that was never
             * swapped.
             */
            const client = ctx.utils.client();
            const first = await (await client.api.version.$get()).json();
            await new Promise((r) => setTimeout(r, 1100));
            const second = await (await client.api.version.$get()).json();

            expect(second.startedAt).toBe(first.startedAt);
            expect(second.uptimeSeconds).toBeGreaterThan(first.uptimeSeconds);
        },
        500_000,
    );

    /**
     * The half the fallback above cannot reach: a container that *was* built by
     * the pipeline. `APP_VERSION`/`GIT_SHA` arrive as Docker build args and are
     * read once at module load, so this loads the module fresh with them set —
     * the same order a container boots in.
     */
    integrationTest(
        "reports the release tag the image was built with",
        async () => {
            const before = {
                v: process.env.APP_VERSION,
                s: process.env.GIT_SHA,
            };
            process.env.APP_VERSION = "2026-08-22.release-99";
            process.env.GIT_SHA = "deadbeef";

            try {
                vi.resetModules();
                const { versionRoute } = await import("~/routes/version/list");
                const res = await versionRoute.request("/");
                const body = (await res.json()) as {
                    version: string;
                    commit: string;
                };

                expect(body.version).toBe("2026-08-22.release-99");
                expect(body.commit).toBe("deadbeef");
            } finally {
                process.env.APP_VERSION = before.v;
                process.env.GIT_SHA = before.s;
                vi.resetModules();
            }
        },
    );
});
