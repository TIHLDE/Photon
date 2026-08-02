import { schema } from "@photon/db";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

/**
 * `formerGroups` on GET /api/user/:id — the ended memberships shown under
 * "Tidligere medlemskap" on a profile.
 */
describe("GET /api/user/:id — former group memberships", () => {
    integrationTest(
        "lists a group the user has left",
        async ({ ctx }) => {
            const viewer = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(viewer);

            const target = await ctx.utils.createTestUser();
            const group = await ctx.utils.createTestGroup({
                slug: "left-group",
                name: "Forlatt gruppe",
                type: "SUBGROUP",
            });

            await ctx.db.insert(schema.groupMembershipHistory).values({
                userId: target.id,
                groupSlug: group.slug,
                role: "leader",
                startedAt: new Date("2023-08-01"),
            });

            const res = await client.api.user[":id"].$get({
                param: { id: target.id },
            });

            expect(res.status).toBe(200);
            const json = await res.json();
            expect(json.formerGroups).toHaveLength(1);
            expect(json.formerGroups[0]?.slug).toBe(group.slug);
            expect(json.formerGroups[0]?.name).toBe("Forlatt gruppe");
            expect(json.formerGroups[0]?.role).toBe("leader");
            expect(json.formerGroups[0]?.startedAt).toBeTruthy();
            expect(json.formerGroups[0]?.endedAt).toBeTruthy();
        },
        500_000,
    );

    integrationTest(
        "leaves a rejoined group out — it is a current membership",
        async ({ ctx }) => {
            const viewer = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(viewer);

            const target = await ctx.utils.createTestUser();
            const group = await ctx.utils.createTestGroup({
                slug: "rejoined-group",
                type: "SUBGROUP",
            });

            // Left once, then back again — plus the role-change rows the
            // Lepton backfill leaves behind for people who never left.
            await ctx.db.insert(schema.groupMembershipHistory).values({
                userId: target.id,
                groupSlug: group.slug,
                role: "member",
                startedAt: new Date("2022-08-01"),
            });
            await ctx.db.insert(schema.groupMembership).values({
                userId: target.id,
                groupSlug: group.slug,
                role: "leader",
            });

            const res = await client.api.user[":id"].$get({
                param: { id: target.id },
            });

            const json = await res.json();
            expect(json.formerGroups).toHaveLength(0);
            expect(json.groups.map((g) => g.slug)).toContain(group.slug);
        },
        500_000,
    );

    integrationTest(
        "lists a group left twice once, by the most recent stint",
        async ({ ctx }) => {
            const viewer = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(viewer);

            const target = await ctx.utils.createTestUser();
            const group = await ctx.utils.createTestGroup({
                slug: "two-stints-group",
                type: "SUBGROUP",
            });

            await ctx.db.insert(schema.groupMembershipHistory).values({
                userId: target.id,
                groupSlug: group.slug,
                role: "member",
                startedAt: new Date("2021-08-01"),
                endedAt: new Date("2022-06-01"),
            });
            await ctx.db.insert(schema.groupMembershipHistory).values({
                userId: target.id,
                groupSlug: group.slug,
                role: "leader",
                startedAt: new Date("2023-08-01"),
                endedAt: new Date("2024-06-01"),
            });

            const res = await client.api.user[":id"].$get({
                param: { id: target.id },
            });

            const json = await res.json();
            expect(json.formerGroups).toHaveLength(1);
            // Nyeste periode vinner, og den var som leder.
            expect(json.formerGroups[0]?.role).toBe("leader");
        },
        500_000,
    );

    integrationTest(
        "is an empty array for a user with no history",
        async ({ ctx }) => {
            const viewer = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(viewer);
            const target = await ctx.utils.createTestUser();

            const res = await client.api.user[":id"].$get({
                param: { id: target.id },
            });

            const json = await res.json();
            expect(json.formerGroups).toEqual([]);
        },
        500_000,
    );
});
