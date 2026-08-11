import { schema } from "@photon/db";
import { and, eq, sql } from "drizzle-orm";
import { describe, expect } from "vitest";
import type { IntegrationTestContext } from "~/test/config/integration";
import { integrationTest } from "~/test/config/integration";

/**
 * PATCH /api/user/:id/study — correcting a member's study programme by hand.
 *
 * STUDY groups are derived from Feide, so the membership routes refuse to
 * touch them; this is the only way to fix a member Feide never speaks for.
 * Unlike the sync it replaces rather than adds, so the assertions below are
 * mostly about what is *gone* afterwards.
 */

const studyGroupsOf = async (
    db: IntegrationTestContext["db"],
    userId: string,
) => {
    const rows = await db
        .select({ slug: schema.groupMembership.groupSlug })
        .from(schema.groupMembership)
        .innerJoin(
            schema.group,
            eq(schema.group.slug, schema.groupMembership.groupSlug),
        )
        .where(
            and(
                eq(schema.groupMembership.userId, userId),
                sql`upper(${schema.group.type}) = 'STUDY'`,
            ),
        );
    return rows.map((r) => r.slug).sort();
};

describe("PATCH /api/user/:id/study", () => {
    integrationTest("requires users:manage", async ({ ctx }) => {
        const caller = await ctx.utils.createTestUser();
        await ctx.utils.giveUserPermissions(caller, ["users:view"]);
        const client = await ctx.utils.clientForUser(caller);

        const target = await ctx.utils.createTestUser();

        const res = await client.api.user[":id"].study.$patch({
            param: { id: target.id },
            json: { studyProgramSlug: "dataingenior" },
        });

        expect(res.status).toBe(403);
    });

    integrationTest(
        "replaces the study group instead of adding a second one",
        async ({ ctx }) => {
            const admin = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(admin, ["users:manage"]);
            const client = await ctx.utils.clientForUser(admin);

            const wrong = await ctx.utils.createTestGroup({
                slug: "dataingenior",
                name: "Dataingeniør",
                type: "STUDY",
            });
            await ctx.utils.createTestGroup({
                slug: "digitalforretningsutvikling",
                name: "Digital forretningsutvikling",
                type: "STUDY",
            });

            const target = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.groupMembership).values({
                userId: target.id,
                groupSlug: wrong.slug,
                role: "member",
            });

            const res = await client.api.user[":id"].study.$patch({
                param: { id: target.id },
                json: { studyProgramSlug: "digitalforretningsutvikling" },
            });
            expect(res.status).toBe(200);

            expect(await studyGroupsOf(ctx.db, target.id)).toEqual([
                "digitalforretningsutvikling",
            ]);
        },
    );

    integrationTest("leaves the cohort group alone", async ({ ctx }) => {
        const admin = await ctx.utils.createTestUser();
        await ctx.utils.giveUserPermissions(admin, ["users:manage"]);
        const client = await ctx.utils.clientForUser(admin);

        await ctx.utils.createTestGroup({
            slug: "dataingenior",
            name: "Dataingeniør",
            type: "STUDY",
        });
        const cohort = await ctx.utils.createTestGroup({
            slug: "2024",
            name: "2024",
            type: "STUDYYEAR",
        });

        const target = await ctx.utils.createTestUser();
        await ctx.db.insert(schema.groupMembership).values({
            userId: target.id,
            groupSlug: cohort.slug,
            role: "member",
        });

        const res = await client.api.user[":id"].study.$patch({
            param: { id: target.id },
            json: { studyProgramSlug: "dataingenior" },
        });
        expect(res.status).toBe(200);

        const [kept] = await ctx.db
            .select({ slug: schema.groupMembership.groupSlug })
            .from(schema.groupMembership)
            .where(
                and(
                    eq(schema.groupMembership.userId, target.id),
                    eq(schema.groupMembership.groupSlug, "2024"),
                ),
            );

        expect(kept?.slug).toBe("2024");
    });

    integrationTest("clears the programme when given null", async ({ ctx }) => {
        const admin = await ctx.utils.createTestUser();
        await ctx.utils.giveUserPermissions(admin, ["users:manage"]);
        const client = await ctx.utils.clientForUser(admin);

        const study = await ctx.utils.createTestGroup({
            slug: "dataingenior",
            name: "Dataingeniør",
            type: "STUDY",
        });

        const target = await ctx.utils.createTestUser();
        await ctx.db.insert(schema.groupMembership).values({
            userId: target.id,
            groupSlug: study.slug,
            role: "member",
        });

        const res = await client.api.user[":id"].study.$patch({
            param: { id: target.id },
            json: { studyProgramSlug: null },
        });
        expect(res.status).toBe(200);

        expect(await studyGroupsOf(ctx.db, target.id)).toEqual([]);
    });

    integrationTest(
        "rejects a group that is not a study programme",
        async ({ ctx }) => {
            const admin = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(admin, ["users:manage"]);
            const client = await ctx.utils.clientForUser(admin);

            const study = await ctx.utils.createTestGroup({
                slug: "dataingenior",
                name: "Dataingeniør",
                type: "STUDY",
            });
            // A committee, not a programme. Letting it through would put the
            // member in a group the study filter reads as their study.
            await ctx.utils.createTestGroup({
                slug: "index",
                name: "Index",
                type: "SUBGROUP",
            });

            const target = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.groupMembership).values({
                userId: target.id,
                groupSlug: study.slug,
                role: "member",
            });

            const res = await client.api.user[":id"].study.$patch({
                param: { id: target.id },
                json: { studyProgramSlug: "index" },
            });

            expect(res.status).toBe(400);
            // Nothing was removed on the way to the error.
            expect(await studyGroupsOf(ctx.db, target.id)).toEqual([
                "dataingenior",
            ]);
        },
    );

    integrationTest("404s for a user that does not exist", async ({ ctx }) => {
        const admin = await ctx.utils.createTestUser();
        await ctx.utils.giveUserPermissions(admin, ["users:manage"]);
        const client = await ctx.utils.clientForUser(admin);

        await ctx.utils.createTestGroup({
            slug: "dataingenior",
            name: "Dataingeniør",
            type: "STUDY",
        });

        const res = await client.api.user[":id"].study.$patch({
            param: { id: "does-not-exist" },
            json: { studyProgramSlug: "dataingenior" },
        });

        expect(res.status).toBe(404);
    });
});
