import { syncDerivedStudyGroups } from "@photon/auth/feide";
import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

/**
 * The `study` and `studyyear` groups are a projection of what Feide reports,
 * not something anyone maintains by hand. These cover the projection itself;
 * `parse-valid-study-programs.test.ts` covers reading Feide's group payload.
 */
describe("derived study groups", () => {
    integrationTest(
        "adds the member to both the study group and the cohort group",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            await ctx.utils.createTestGroup({ slug: "dataingenir" });

            await ctx.db.transaction((tx) =>
                syncDerivedStudyGroups(tx, user.id, "dataingenir", 2024),
            );

            const memberships = await ctx.db
                .select({ groupSlug: schema.groupMembership.groupSlug })
                .from(schema.groupMembership)
                .where(eq(schema.groupMembership.userId, user.id));

            expect(memberships.map((m) => m.groupSlug).sort()).toEqual([
                "2024",
                "dataingenir",
            ]);
        },
    );

    integrationTest(
        "creates the cohort group when that intake is new",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            await ctx.utils.createTestGroup({ slug: "dataingenir" });

            await ctx.db.transaction((tx) =>
                syncDerivedStudyGroups(tx, user.id, "dataingenir", 2031),
            );

            const created = await ctx.db.query.group.findFirst({
                where: eq(schema.group.slug, "2031"),
            });

            expect(created?.type).toBe("STUDYYEAR");
            expect(created?.name).toBe("2031");
        },
    );

    integrationTest("is safe to run again", async ({ ctx }) => {
        const user = await ctx.utils.createTestUser();
        await ctx.utils.createTestGroup({ slug: "dataingenir" });

        for (let i = 0; i < 3; i++) {
            await ctx.db.transaction((tx) =>
                syncDerivedStudyGroups(tx, user.id, "dataingenir", 2024),
            );
        }

        const memberships = await ctx.db
            .select({ groupSlug: schema.groupMembership.groupSlug })
            .from(schema.groupMembership)
            .where(eq(schema.groupMembership.userId, user.id));

        expect(memberships).toHaveLength(2);
    });

    integrationTest(
        "keeps a leader's role rather than demoting them to member",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            await ctx.utils.createTestGroup({ slug: "dataingenir" });

            await ctx.db.insert(schema.groupMembership).values({
                userId: user.id,
                groupSlug: "dataingenir",
                role: "leader",
            });

            await ctx.db.transaction((tx) =>
                syncDerivedStudyGroups(tx, user.id, "dataingenir", 2024),
            );

            const membership = await ctx.db.query.groupMembership.findFirst({
                where: and(
                    eq(schema.groupMembership.userId, user.id),
                    eq(schema.groupMembership.groupSlug, "dataingenir"),
                ),
            });

            expect(membership?.role).toBe("leader");
        },
    );

    integrationTest(
        "still records the cohort when the study group is missing",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();

            await ctx.db.transaction((tx) =>
                syncDerivedStudyGroups(tx, user.id, "not-seeded", 2024),
            );

            const memberships = await ctx.db
                .select({ groupSlug: schema.groupMembership.groupSlug })
                .from(schema.groupMembership)
                .where(eq(schema.groupMembership.userId, user.id));

            expect(memberships.map((m) => m.groupSlug)).toEqual(["2024"]);
        },
    );
});
