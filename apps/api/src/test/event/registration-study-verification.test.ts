import { schema } from "@photon/db";
import { describe, expect } from "vitest";
import {
    type IntegrationTestContext,
    integrationTest,
} from "~/test/config/integration";

/**
 * The participant list tells the organizer how well the study behind a
 * priority is known.
 *
 * A study group is never taken away, so it says "has studied this", not
 * "studies this". The organizer could not tell a programme NTNU confirmed this
 * month from one typed into a fadderuka form in 2024 — and it is that second
 * kind the priority pools are handing seats out on.
 */
async function seedProgramme(ctx: IntegrationTestContext) {
    await ctx.utils.createTestGroup({
        slug: "dataingenir",
        name: "Dataingeniør",
        type: "STUDY",
    });

    const [programme] = await ctx.db
        .insert(schema.studyProgram)
        .values({
            slug: "dataingenir",
            feideCode: "BIDATA",
            displayName: "Dataingeniør",
            type: "bachelor",
        })
        .returning({ id: schema.studyProgram.id });

    return programme?.id as number;
}

const daysAgo = (days: number) =>
    new Date(Date.now() - days * 24 * 60 * 60 * 1000);

async function listParticipants(
    ctx: IntegrationTestContext,
    eventId: string,
    userId: string,
) {
    const admin = await ctx.utils.createTestUser();
    await ctx.utils.giveUserPermissions(admin, ["events:manage"]);
    const client = await ctx.utils.clientForUser(admin);

    const res = await client.api.event[":eventId"].registration.$get({
        param: { eventId },
        query: {},
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    return body.registeredUsers.find((u) => u.id === userId);
}

describe("Study verification on the participant list", () => {
    integrationTest(
        "marks a study Feide has never spoken for as unverified",
        async ({ ctx }) => {
            await ctx.utils.setupEventCategories();
            await seedProgramme(ctx);

            const event = await ctx.utils.createTestEvent({ capacity: 10 });
            const member = await ctx.utils.createTestUser();
            // The group and nothing else — the state 1346 memberships in
            // production are in, all of them from the Lepton migration.
            await ctx.db.insert(schema.groupMembership).values({
                userId: member.id,
                groupSlug: "dataingenir",
            });
            // Straight to "registered": the list serves the resolved
            // statuses, and the resolver is not what is under test here.
            await ctx.db.insert(schema.eventRegistration).values({
                eventId: event.id,
                userId: member.id,
                status: "registered",
            });

            const row = await listParticipants(ctx, event.id, member.id);
            expect(row?.studyVerification).toBe("unverified");
        },
        500_000,
    );

    integrationTest(
        "marks a recently confirmed enrolment as active",
        async ({ ctx }) => {
            await ctx.utils.setupEventCategories();
            const programmeId = await seedProgramme(ctx);

            const event = await ctx.utils.createTestEvent({ capacity: 10 });
            const member = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.groupMembership).values({
                userId: member.id,
                groupSlug: "dataingenir",
            });
            await ctx.db.insert(schema.studyProgramMembership).values({
                userId: member.id,
                studyProgramId: programmeId,
                startYear: 2025,
                startYearSource: "feide",
                feideActive: true,
                feideCheckedAt: daysAgo(3),
            });
            // Straight to "registered": the list serves the resolved
            // statuses, and the resolver is not what is under test here.
            await ctx.db.insert(schema.eventRegistration).values({
                eventId: event.id,
                userId: member.id,
                status: "registered",
            });

            const row = await listParticipants(ctx, event.id, member.id);
            expect(row?.studyVerification).toBe("active");
        },
        500_000,
    );

    integrationTest(
        "marks a member Feide says is no longer enrolled as inactive",
        async ({ ctx }) => {
            await ctx.utils.setupEventCategories();
            const programmeId = await seedProgramme(ctx);

            const event = await ctx.utils.createTestEvent({ capacity: 10 });
            const member = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.groupMembership).values({
                userId: member.id,
                groupSlug: "dataingenir",
            });
            await ctx.db.insert(schema.studyProgramMembership).values({
                userId: member.id,
                studyProgramId: programmeId,
                startYear: 2022,
                startYearSource: "feide",
                // A recent, explicit "not enrolled" — the one thing here we
                // actually know, and what an alumni-closed event turns on.
                feideActive: false,
                feideCheckedAt: daysAgo(5),
            });
            await ctx.db.insert(schema.eventRegistration).values({
                eventId: event.id,
                userId: member.id,
                status: "registered",
            });

            const row = await listParticipants(ctx, event.id, member.id);
            expect(row?.studyVerification).toBe("inactive");
        },
        500_000,
    );

    integrationTest(
        "marks an answer older than a semester as stale",
        async ({ ctx }) => {
            await ctx.utils.setupEventCategories();
            const programmeId = await seedProgramme(ctx);

            const event = await ctx.utils.createTestEvent({ capacity: 10 });
            const member = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.groupMembership).values({
                userId: member.id,
                groupSlug: "dataingenir",
            });
            await ctx.db.insert(schema.studyProgramMembership).values({
                userId: member.id,
                studyProgramId: programmeId,
                startYear: 2022,
                startYearSource: "feide",
                feideActive: true,
                // Past the 120 days, so a semester has turned over since we
                // last heard anything.
                feideCheckedAt: daysAgo(200),
            });
            // Straight to "registered": the list serves the resolved
            // statuses, and the resolver is not what is under test here.
            await ctx.db.insert(schema.eventRegistration).values({
                eventId: event.id,
                userId: member.id,
                status: "registered",
            });

            const row = await listParticipants(ctx, event.id, member.id);
            expect(row?.studyVerification).toBe("stale");
        },
        500_000,
    );
});
