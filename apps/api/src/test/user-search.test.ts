import { schema } from "@photon/db";
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

    integrationTest(
        "lets a group leader search for their own group, but not otherwise",
        async ({ ctx }) => {
            // Lederen har lov til å legge til medlemmer, men har ingen av de
            // globale tilgangene søket krevde — uten `groupSlug` ser et 403 ut
            // som at personen ikke finnes.
            const group = await ctx.utils.createTestGroup({ slug: "plask" });
            const otherGroup = await ctx.utils.createTestGroup({
                slug: "annen-gruppe",
            });
            const leader = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.groupMembership).values({
                groupSlug: group.slug,
                userId: leader.id,
                role: "leader",
            });
            const client = await ctx.utils.clientForUser(leader);

            const target = await ctx.auth.api.createUser({
                body: {
                    email: "plaskmedlem@test.com",
                    name: "Torkil Plasketest",
                    password: "test123!",
                    data: { username: "torkilplask" },
                },
            });

            const forOwnGroup = await client.api.user.search.$get({
                query: { q: "plasketest", groupSlug: group.slug },
            });
            expect(forOwnGroup.status).toBe(200);
            expect(
                (await forOwnGroup.json()).some((u) => u.id === target.user.id),
            ).toBe(true);

            // En annen gruppe er ikke lederens bord.
            const forOtherGroup = await client.api.user.search.$get({
                query: { q: "plasketest", groupSlug: otherGroup.slug },
            });
            expect(forOtherGroup.status).toBe(403);

            // Og uten gruppe gjelder fortsatt users:view/roles:assign.
            const withoutGroup = await client.api.user.search.$get({
                query: { q: "plasketest" },
            });
            expect(withoutGroup.status).toBe(403);
        },
        500_000,
    );
});
