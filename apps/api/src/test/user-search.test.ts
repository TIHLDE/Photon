import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

describe("user search", () => {
    integrationTest(
        "finds users by name and by username, requires permission",
        async ({ ctx }) => {
            const admin = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(admin, ["users:view"]);
            const client = await ctx.utils.clientForUser(admin);

            const target = await ctx.auth.api.createUser({
                body: {
                    email: "searchme@test.com",
                    name: "Kari Søketest",
                    password: "test123!",
                    data: { username: "karisoek" },
                },
            });

            // By name fragment (case-insensitive)
            const byName = await client.api.user.search.$get({
                query: { q: "søketest" },
            });
            expect(byName.status).toBe(200);
            const nameResults = await byName.json();
            expect(nameResults.some((u) => u.id === target.user.id)).toBe(true);

            // By username fragment
            const byUsername = await client.api.user.search.$get({
                query: { q: "karisoe" },
            });
            expect(byUsername.status).toBe(200);
            const usernameResults = await byUsername.json();
            expect(usernameResults.some((u) => u.id === target.user.id)).toBe(
                true,
            );

            // Without permission → 403
            const plain = await ctx.utils.createTestUser();
            const plainClient = await ctx.utils.clientForUser(plain);
            const forbidden = await plainClient.api.user.search.$get({
                query: { q: "søketest" },
            });
            expect(forbidden.status).toBe(403);
        },
        500_000,
    );
});
