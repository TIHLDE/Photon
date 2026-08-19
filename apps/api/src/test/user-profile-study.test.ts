import { schema } from "@photon/db";
import { describe, expect } from "vitest";
import type { IntegrationTestContext } from "~/test/config/integration";
import { integrationTest } from "~/test/config/integration";

/**
 * GET /api/user/:id — the study a profile shows.
 *
 * The profile page used to work this out in the browser, from the group list
 * the endpoint happened to return: it took the first STUDY group in whatever
 * order Postgres produced, and computed the class level without the master
 * offset. Both are rules the server already owns, so the profile serves them
 * and the client renders what it is given.
 */

const seedProgrammes = async (ctx: IntegrationTestContext) => {
    await ctx.utils.createTestGroup({
        slug: "digital-forretningsutvikling",
        name: "Digital forretningsutvikling",
        type: "STUDY",
    });
    await ctx.utils.createTestGroup({
        slug: "digital-samhandling",
        name: "Digital transformasjon",
        type: "STUDY",
    });
    await ctx.utils.createTestGroup({
        slug: "2023",
        name: "2023",
        type: "STUDYYEAR",
    });

    const [bachelor] = await ctx.db
        .insert(schema.studyProgram)
        .values({
            slug: "digital-forretningsutvikling",
            feideCode: "ITBAITBEDR",
            displayName: "Digital Forretningsutvikling",
            type: "bachelor",
        })
        .returning({ id: schema.studyProgram.id });
    const [master] = await ctx.db
        .insert(schema.studyProgram)
        .values({
            slug: "digital-samhandling",
            feideCode: "ITMAIKTSA",
            displayName: "Digital Samhandling",
            type: "master",
        })
        .returning({ id: schema.studyProgram.id });

    return {
        bachelorId: bachelor?.id as number,
        masterId: master?.id as number,
    };
};

describe("GET /api/user/:id — study on the profile", () => {
    integrationTest(
        "shows the programme the member is on now, with its own class level",
        async ({ ctx }) => {
            const viewer = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(viewer);

            const { bachelorId, masterId } = await seedProgrammes(ctx);

            const target = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.groupMembership).values([
                {
                    userId: target.id,
                    groupSlug: "digital-forretningsutvikling",
                    role: "member",
                },
                {
                    userId: target.id,
                    groupSlug: "digital-samhandling",
                    role: "member",
                },
                { userId: target.id, groupSlug: "2023", role: "member" },
            ]);
            await ctx.db.insert(schema.studyProgramMembership).values([
                {
                    userId: target.id,
                    studyProgramId: bachelorId,
                    startYear: 2023,
                    startYearSource: "derived",
                    feideActive: false,
                },
                {
                    userId: target.id,
                    studyProgramId: masterId,
                    startYear: 2026,
                    startYearSource: "derived",
                    feideActive: true,
                },
            ]);

            const res = await client.api.user[":id"].$get({
                param: { id: target.id },
            });
            expect(res.status).toBe(200);
            const body = await res.json();

            expect(body.studyProgram).toBe("Digital transformasjon");
            // The master's own intake, not the 2023 cohort group.
            expect(body.studyStartYear).toBe(2026);
            /**
             * Year one of a master is 4. klasse. Computed in the browser from
             * the start year alone it would have read as 1., and computed from
             * the cohort group it happened to be right only because the master
             * followed the bachelor after exactly three years.
             */
            expect(body.classYear).toBe(4);
        },
    );

    integrationTest(
        "gives a finished bachelor no class level",
        async ({ ctx }) => {
            const viewer = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(viewer);

            const { bachelorId } = await seedProgrammes(ctx);

            const target = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.groupMembership).values([
                {
                    userId: target.id,
                    groupSlug: "digital-forretningsutvikling",
                    role: "member",
                },
                { userId: target.id, groupSlug: "2023", role: "member" },
            ]);
            await ctx.db.insert(schema.studyProgramMembership).values({
                userId: target.id,
                studyProgramId: bachelorId,
                startYear: 2023,
                startYearSource: "derived",
                feideActive: false,
            });

            const res = await client.api.user[":id"].$get({
                param: { id: target.id },
            });
            const body = await res.json();

            // Three years from 2023 is done, so the profile shows the cohort
            // rather than a class level they are no longer on.
            expect(body.studyProgram).toBe("Digital forretningsutvikling");
            expect(body.studyStartYear).toBe(2023);
            expect(body.classYear).toBeNull();
        },
    );
});
