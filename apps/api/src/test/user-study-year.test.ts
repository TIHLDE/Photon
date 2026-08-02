import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import type { IntegrationTestContext } from "~/test/config/integration";
import { integrationTest } from "~/test/config/integration";

/**
 * PATCH /api/user/:id/study-year — correcting a member's cohort by hand.
 *
 * The escape hatch for the assumption the Feide sync makes when NTNU gives a
 * programme no `fc:fs:kull`. The three membership routes refuse to touch
 * STUDYYEAR groups directly, so this is the only sanctioned way in, and it has
 * to leave the cohort group and the study-programme row agreeing with each
 * other.
 */

const cohortGroupsOf = async (
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
                eq(schema.group.type, "STUDYYEAR"),
            ),
        );
    return rows.map((r) => r.slug).sort();
};

describe("PATCH /api/user/:id/study-year", () => {
    integrationTest("requires users:manage", async ({ ctx }) => {
        const caller = await ctx.utils.createTestUser();
        await ctx.utils.giveUserPermissions(caller, ["users:view"]);
        const client = await ctx.utils.clientForUser(caller);

        const target = await ctx.utils.createTestUser();

        const res = await client.api.user[":id"]["study-year"].$patch({
            param: { id: target.id },
            json: { startYear: 2024 },
        });

        expect(res.status).toBe(403);
    });

    integrationTest(
        "moves the cohort group and records the correction",
        async ({ ctx }) => {
            const admin = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(admin, ["users:manage"]);
            const client = await ctx.utils.clientForUser(admin);

            const study = await ctx.utils.createTestGroup({
                slug: "dataingenior",
                name: "Dataingeniør",
                type: "STUDY",
            });
            await ctx.db.insert(schema.studyProgram).values({
                slug: "dataingenior",
                feideCode: "BIDATA",
                displayName: "Dataingeniør",
                type: "bachelor",
            });

            const target = await ctx.utils.createTestUser();
            const old = await ctx.utils.createTestGroup({
                slug: "2026",
                name: "2026",
                type: "STUDYYEAR",
            });
            await ctx.db.insert(schema.groupMembership).values([
                { userId: target.id, groupSlug: study.slug, role: "member" },
                { userId: target.id, groupSlug: old.slug, role: "member" },
            ]);

            const res = await client.api.user[":id"]["study-year"].$patch({
                param: { id: target.id },
                json: { startYear: 2024 },
            });
            expect(res.status).toBe(200);

            // The guessed intake is gone, not merely joined by a second one:
            // every read takes Math.max() over the cohort groups.
            expect(await cohortGroupsOf(ctx.db, target.id)).toEqual(["2024"]);

            /**
             * The 1699-of-1707 case: no study-programme row existed, so the
             * correction had nowhere to live. Without creating one, a later
             * Feide login that does bring a year would quietly win.
             */
            const [membership] = await ctx.db
                .select({
                    startYear: schema.studyProgramMembership.startYear,
                    source: schema.studyProgramMembership.startYearSource,
                })
                .from(schema.studyProgramMembership)
                .where(eq(schema.studyProgramMembership.userId, target.id));

            expect(membership?.startYear).toBe(2024);
            expect(membership?.source).toBe("manual");
        },
    );

    integrationTest(
        "creates the cohort group when the intake is new",
        async ({ ctx }) => {
            const admin = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(admin, ["users:manage"]);
            const client = await ctx.utils.clientForUser(admin);

            const target = await ctx.utils.createTestUser();

            const res = await client.api.user[":id"]["study-year"].$patch({
                param: { id: target.id },
                json: { startYear: 2019 },
            });
            expect(res.status).toBe(200);

            const [created] = await ctx.db
                .select({ type: schema.group.type })
                .from(schema.group)
                .where(eq(schema.group.slug, "2019"));

            expect(created?.type).toBe("STUDYYEAR");
            expect(await cohortGroupsOf(ctx.db, target.id)).toEqual(["2019"]);
        },
    );

    integrationTest("clears the cohort when given null", async ({ ctx }) => {
        const admin = await ctx.utils.createTestUser();
        await ctx.utils.giveUserPermissions(admin, ["users:manage"]);
        const client = await ctx.utils.clientForUser(admin);

        const target = await ctx.utils.createTestUser();
        const cohort = await ctx.utils.createTestGroup({
            slug: "2026",
            name: "2026",
            type: "STUDYYEAR",
        });
        await ctx.db.insert(schema.groupMembership).values({
            userId: target.id,
            groupSlug: cohort.slug,
            role: "member",
        });

        const res = await client.api.user[":id"]["study-year"].$patch({
            param: { id: target.id },
            json: { startYear: null },
        });
        expect(res.status).toBe(200);

        expect(await cohortGroupsOf(ctx.db, target.id)).toEqual([]);
    });

    integrationTest(
        "rejects a year outside the sane window",
        async ({ ctx }) => {
            const admin = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(admin, ["users:manage"]);
            const client = await ctx.utils.clientForUser(admin);

            const target = await ctx.utils.createTestUser();

            // Same bounds parseValidStudyPrograms enforces on Feide's own data, so
            // a correction cannot express an intake the sync would have refused.
            // The bounds live in Zod, not the type, so this compiles and is
            // rejected at runtime — which is exactly what is being asserted.
            const res = await client.api.user[":id"]["study-year"].$patch({
                param: { id: target.id },
                json: { startYear: 1899 },
            });

            expect(res.status).toBe(400);
        },
    );

    integrationTest("404s for a user that does not exist", async ({ ctx }) => {
        const admin = await ctx.utils.createTestUser();
        await ctx.utils.giveUserPermissions(admin, ["users:manage"]);
        const client = await ctx.utils.clientForUser(admin);

        const res = await client.api.user[":id"]["study-year"].$patch({
            param: { id: "does-not-exist" },
            json: { startYear: 2024 },
        });

        expect(res.status).toBe(404);
    });
});
