import {
    applyFeideStudyPrograms,
    parseValidStudyPrograms,
    partitionByCampus,
    resolveCampus,
} from "@photon/auth/feide";
import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";
import type { IntegrationTestContext } from "~/test/config/integration";

/**
 * Bøter in a study group are for the students actually enrolled.
 *
 * A study group's roster is a projection of Feide that only ever grows —
 * leaving a programme never removes the group — so `digital-samhandling` lists
 * everyone who ever took digtrans, alumni included. Membership alone therefore
 * cannot be the access rule there, and the cohort year cannot stand in for it
 * either: for most members the cohort group carries the year they started
 * their *bachelor*, not the master. `studyProgramMembership.feideActive`, set
 * from `membership.active` on every Feide login, is the only field that says
 * "enrolled now".
 */

/** A study group plus the study programme it projects. They share a slug. */
async function createStudyProgramGroup(
    ctx: IntegrationTestContext,
    slug: string,
    feideCode = slug.toUpperCase().slice(0, 32),
) {
    const group = await ctx.utils.createTestGroup({
        slug,
        name: "Digital transformasjon",
        type: "STUDY",
        finesActivated: true,
    });

    const [program] = await ctx.db
        .insert(schema.studyProgram)
        .values({
            slug,
            feideCode,
            displayName: "Digital transformasjon",
            type: "master",
        })
        .returning();

    if (!program) throw new Error("Failed to create study programme");

    return { group, program };
}

/**
 * Put a user in the group the way a Feide login does, and record what Feide
 * last said about their enrolment. `feideActive: null` is the state every
 * member migrated from Lepton is in — we have never had an answer.
 */
async function enrol(
    ctx: IntegrationTestContext,
    userId: string,
    groupSlug: string,
    programId: number,
    feideActive: boolean | null,
) {
    await ctx.db.insert(schema.groupMembership).values({
        userId,
        groupSlug,
        role: "member",
    });

    await ctx.db.insert(schema.studyProgramMembership).values({
        userId,
        studyProgramId: programId,
        feideActive,
        feideCheckedAt: feideActive === null ? null : new Date(),
    });
}

describe("fines in a study group", () => {
    integrationTest(
        "an enrolled student may give and read fines",
        async ({ ctx }) => {
            const { group, program } = await createStudyProgramGroup(
                ctx,
                "digtrans-active",
            );

            const giver = await ctx.utils.createTestUser();
            const target = await ctx.utils.createTestUser();
            await enrol(ctx, giver.id, group.slug, program.id, true);
            await enrol(ctx, target.id, group.slug, program.id, true);

            const client = await ctx.utils.clientForUser(giver);

            const created = await client.api.groups[":groupSlug"].fines.$post({
                param: { groupSlug: group.slug },
                json: {
                    userId: target.id,
                    groupSlug: group.slug,
                    reason: "Møtte ikke opp",
                    amount: 1,
                },
            });
            expect(created.status).toBe(201);

            const listed = await client.api.groups[":groupSlug"].fines.$get({
                param: { groupSlug: group.slug },
                query: {},
            });
            expect(listed.status).toBe(200);
        },
        500_000,
    );

    integrationTest(
        "an alumnus in the group may not give fines",
        async ({ ctx }) => {
            const { group, program } = await createStudyProgramGroup(
                ctx,
                "digtrans-alumni",
            );

            const alumnus = await ctx.utils.createTestUser();
            const student = await ctx.utils.createTestUser();
            await enrol(ctx, alumnus.id, group.slug, program.id, false);
            await enrol(ctx, student.id, group.slug, program.id, true);

            const client = await ctx.utils.clientForUser(alumnus);

            const response = await client.api.groups[":groupSlug"].fines.$post({
                param: { groupSlug: group.slug },
                json: {
                    userId: student.id,
                    groupSlug: group.slug,
                    reason: "Møtte ikke opp",
                    amount: 1,
                },
            });

            expect(response.status).toBe(403);
        },
        500_000,
    );

    integrationTest(
        "an alumnus in the group may not read the group's fines",
        async ({ ctx }) => {
            const { group, program } = await createStudyProgramGroup(
                ctx,
                "digtrans-alumni-read",
            );

            const alumnus = await ctx.utils.createTestUser();
            await enrol(ctx, alumnus.id, group.slug, program.id, false);

            const client = await ctx.utils.clientForUser(alumnus);

            const response = await client.api.groups[":groupSlug"].fines.$get({
                param: { groupSlug: group.slug },
                query: {},
            });

            expect(response.status).toBe(403);
        },
        500_000,
    );

    integrationTest(
        "a member we have never heard from via Feide is not let in",
        async ({ ctx }) => {
            const { group, program } = await createStudyProgramGroup(
                ctx,
                "digtrans-unknown",
            );

            const unknown = await ctx.utils.createTestUser();
            const student = await ctx.utils.createTestUser();
            await enrol(ctx, unknown.id, group.slug, program.id, null);
            await enrol(ctx, student.id, group.slug, program.id, true);

            const client = await ctx.utils.clientForUser(unknown);

            const response = await client.api.groups[":groupSlug"].fines.$post({
                param: { groupSlug: group.slug },
                json: {
                    userId: student.id,
                    groupSlug: group.slug,
                    reason: "Møtte ikke opp",
                    amount: 1,
                },
            });

            expect(response.status).toBe(403);
        },
        500_000,
    );

    integrationTest(
        "an alumnus may not be handed a fine either",
        async ({ ctx }) => {
            const { group, program } = await createStudyProgramGroup(
                ctx,
                "digtrans-alumni-target",
            );

            const student = await ctx.utils.createTestUser();
            const alumnus = await ctx.utils.createTestUser();
            await enrol(ctx, student.id, group.slug, program.id, true);
            await enrol(ctx, alumnus.id, group.slug, program.id, false);

            const client = await ctx.utils.clientForUser(student);

            const response = await client.api.groups[":groupSlug"].fines.$post({
                param: { groupSlug: group.slug },
                json: {
                    userId: alumnus.id,
                    groupSlug: group.slug,
                    reason: "Møtte ikke opp",
                    amount: 1,
                },
            });

            expect(response.status).toBe(400);
        },
        500_000,
    );

    integrationTest(
        "the botsjef keeps access after graduating",
        async ({ ctx }) => {
            const botsjef = await ctx.utils.createTestUser();
            const { group, program } = await createStudyProgramGroup(
                ctx,
                "digtrans-botsjef",
            );

            await ctx.db
                .update(schema.group)
                .set({ finesAdminId: botsjef.id })
                .where(eq(schema.group.slug, group.slug));

            await enrol(ctx, botsjef.id, group.slug, program.id, false);

            const client = await ctx.utils.clientForUser(botsjef);

            const response = await client.api.groups[":groupSlug"].fines.$get({
                param: { groupSlug: group.slug },
                query: {},
            });

            expect(response.status).toBe(200);
        },
        500_000,
    );

    integrationTest(
        "an ordinary group is untouched — membership is still the whole rule",
        async ({ ctx }) => {
            const group = await ctx.utils.createTestGroup({
                slug: "vanlig-gruppe-boter",
                type: "COMMITTEE",
                finesActivated: true,
            });

            const giver = await ctx.utils.createTestUser();
            const target = await ctx.utils.createTestUser();
            for (const userId of [giver.id, target.id]) {
                await ctx.db.insert(schema.groupMembership).values({
                    userId,
                    groupSlug: group.slug,
                    role: "member",
                });
            }

            const client = await ctx.utils.clientForUser(giver);

            const response = await client.api.groups[":groupSlug"].fines.$post({
                param: { groupSlug: group.slug },
                json: {
                    userId: target.id,
                    groupSlug: group.slug,
                    reason: "Møtte ikke opp",
                    amount: 1,
                },
            });

            expect(response.status).toBe(201);
        },
        500_000,
    );

    integrationTest(
        "the group endpoint tells the client who may use fines",
        async ({ ctx }) => {
            const { group, program } = await createStudyProgramGroup(
                ctx,
                "digtrans-viewer-flag",
            );

            const student = await ctx.utils.createTestUser();
            const alumnus = await ctx.utils.createTestUser();
            await enrol(ctx, student.id, group.slug, program.id, true);
            await enrol(ctx, alumnus.id, group.slug, program.id, false);

            const studentClient = await ctx.utils.clientForUser(student);
            const studentView = await studentClient.api.groups[":slug"].$get({
                param: { slug: group.slug },
            });
            expect(studentView.status).toBe(200);
            expect((await studentView.json()).viewerCanUseFines).toBe(true);

            const alumnusClient = await ctx.utils.clientForUser(alumnus);
            const alumnusView = await alumnusClient.api.groups[":slug"].$get({
                param: { slug: group.slug },
            });
            expect(alumnusView.status).toBe(200);
            expect((await alumnusView.json()).viewerCanUseFines).toBe(false);
        },
        500_000,
    );

    /**
     * Drives the real callback path — parse, campus, write — rather than
     * hand-writing the row, because the flag is only worth anything if an
     * actual login sets it. `showAll=true` means a finished programme still
     * comes back from Dataporten, with `membership.active` false; that is the
     * case being pinned here.
     */
    integrationTest(
        "a Feide login records whether the programme is still active",
        async ({ ctx }) => {
            const { group, program } = await createStudyProgramGroup(
                ctx,
                "digtrans-feide-sync",
                "ITMAIKTSA",
            );

            const user = await ctx.utils.createTestUser();
            await enrol(ctx, user.id, group.slug, program.id, true);

            const lapsed = [
                {
                    id: "fc:fs:fs:prg:ntnu.no:ITMAIKTSA",
                    type: "fc:fs:prg",
                    displayName: "ITMAIKTSA",
                    membership: { active: false },
                },
            ];

            const campus = resolveCampus(lapsed);
            const { allowed, campusRejected } = partitionByCampus(
                parseValidStudyPrograms(lapsed),
                campus,
            );

            await applyFeideStudyPrograms(
                ctx.db,
                user.id,
                allowed,
                campusRejected,
                campus,
                null,
            );

            const [row] = await ctx.db
                .select()
                .from(schema.studyProgramMembership)
                .where(
                    and(
                        eq(schema.studyProgramMembership.userId, user.id),
                        eq(
                            schema.studyProgramMembership.studyProgramId,
                            program.id,
                        ),
                    ),
                );

            expect(row?.feideActive).toBe(false);
            expect(row?.feideCheckedAt).not.toBeNull();
        },
        500_000,
    );
});
