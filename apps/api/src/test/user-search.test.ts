import { schema } from "@photon/db";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

describe("user search", () => {
    integrationTest(
        "matches every name or username word in any order, without middle names",
        async ({ ctx }) => {
            const admin = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(admin, ["users:view"]);
            const client = await ctx.utils.clientForUser(admin);
            const target = await ctx.auth.api.createUser({
                body: {
                    email: "word-search@test.com",
                    name: "Stian Closs Walmann",
                    password: "test123!",
                    data: { username: "scw123" },
                },
            });
            for (const name of ["Stian Other", "Other Walmann"]) {
                await ctx.auth.api.createUser({
                    body: {
                        email: `${crypto.randomUUID()}@test.com`,
                        name,
                        password: "test123!",
                    },
                });
            }

            for (const q of [
                "Stian Walmann",
                "Walmann Stian",
                "  STIAN\t WALMANN  ",
                "sti walm",
                "Stian scw123",
            ]) {
                const response = await client.api.user.search.$get({
                    query: { q },
                });
                expect(response.status).toBe(200);
                expect((await response.json()).map((user) => user.id)).toEqual([
                    target.user.id,
                ]);
            }

            const blank = await client.api.user.search.$get({
                query: { q: "  " },
            });
            expect(blank.status).toBe(400);
        },
    );

    integrationTest(
        "treats LIKE wildcard characters as literal search text",
        async ({ ctx }) => {
            const admin = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(admin, ["users:view"]);
            const client = await ctx.utils.clientForUser(admin);
            const target = await ctx.auth.api.createUser({
                body: {
                    email: "literal-search@test.com",
                    name: "Literal %_\\ Person",
                    password: "test123!",
                },
            });
            await ctx.auth.api.createUser({
                body: {
                    email: "not-literal-search@test.com",
                    name: "Literal Person",
                    password: "test123!",
                },
            });
            for (const q of ["Literal %", "Literal _", "Literal \\"]) {
                const response = await client.api.user.search.$get({
                    query: { q },
                });
                expect(response.status).toBe(200);
                expect((await response.json()).map((user) => user.id)).toEqual([
                    target.user.id,
                ]);
            }
        },
    );

    integrationTest(
        "puts exact matches before alphabetical partial matches",
        async ({ ctx }) => {
            const admin = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(admin, ["users:view"]);
            const client = await ctx.utils.clientForUser(admin);
            const noUsername = await ctx.auth.api.createUser({
                body: {
                    email: "no-username-search@test.com",
                    name: "A Search Prefix",
                    password: "test123!",
                },
            });
            const partial = await ctx.auth.api.createUser({
                body: {
                    email: "partial-search@test.com",
                    name: "B Search Prefix",
                    password: "test123!",
                    data: { username: "prefixlong" },
                },
            });
            const exact = await ctx.auth.api.createUser({
                body: {
                    email: "exact-search@test.com",
                    name: "Z Search Exact",
                    password: "test123!",
                    data: { username: "prefix" },
                },
            });
            const response = await client.api.user.search.$get({
                query: { q: "PREFIX" },
            });
            expect(response.status).toBe(200);
            const results = await response.json();
            expect(results.map((user) => user.id)).toEqual([
                exact.user.id,
                noUsername.user.id,
                partial.user.id,
            ]);
            expect(
                results.find((user) => user.id === noUsername.user.id)
                    ?.username,
            ).toBeNull();

            const partialName = await ctx.auth.api.createUser({
                body: {
                    email: "partial-name-search@test.com",
                    name: "Z Middle Search Exact",
                    password: "test123!",
                },
            });
            for (const q of [
                "Z Search Exact",
                "  z  SEARCH   exact  ",
                "Z\tSearch\nExact",
            ]) {
                const response = await client.api.user.search.$get({
                    query: { q },
                });
                expect(response.status).toBe(200);
                expect((await response.json()).map((user) => user.id)).toEqual([
                    exact.user.id,
                    partialName.user.id,
                ]);
            }
        },
    );

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
                    name: "Torkil Middle Plasketest",
                    password: "test123!",
                    data: { username: "torkilplask" },
                },
            });

            const forOwnGroup = await client.api.user.search.$get({
                query: { q: "Plasketest Torkil", groupSlug: group.slug },
            });
            expect(forOwnGroup.status).toBe(200);
            expect(
                (await forOwnGroup.json()).some((u) => u.id === target.user.id),
            ).toBe(true);

            // En annen gruppe er ikke lederens bord.
            const forOtherGroup = await client.api.user.search.$get({
                query: { q: "Plasketest Torkil", groupSlug: otherGroup.slug },
            });
            expect(forOtherGroup.status).toBe(403);

            // Og uten gruppe gjelder fortsatt users:view/roles:assign.
            const withoutGroup = await client.api.user.search.$get({
                query: { q: "Plasketest Torkil" },
            });
            expect(withoutGroup.status).toBe(403);
        },
        500_000,
    );
});
