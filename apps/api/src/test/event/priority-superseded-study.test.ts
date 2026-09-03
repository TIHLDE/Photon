import { schema } from "@photon/db";
import { describe, expect, vi } from "vitest";
import { resolveRegistrationsForEvent } from "~/lib/event/resolve-registration";
import {
    type IntegrationTestContext,
    integrationTest,
} from "~/test/config/integration";

vi.mock("~/lib/vipps", () => ({
    refundPayment: vi.fn(),
    capturePayment: vi.fn(),
    cancelPayment: vi.fn(),
    createPayment: vi.fn(),
    getPaymentDetails: vi.fn(),
    setupWebhooks: vi.fn(),
    verifyVippsWebhookRequest: vi.fn(),
}));

/**
 * An event with one spot, prioritizing the bachelor's students by group.
 *
 * Group-only is the shape that carries the bug: 62 pools in production ask
 * about a study group and nothing else, and the group is the one thing a
 * change of programme never takes away.
 */
async function seedBachelorPoolEvent(ctx: IntegrationTestContext) {
    await ctx.utils.setupEventCategories();

    await ctx.db.insert(schema.group).values([
        {
            slug: "dataingenir",
            name: "Dataingeniør",
            type: "STUDY",
            finesInfo: "",
            finesActivated: false,
        },
        {
            slug: "digital-samhandling",
            name: "Digital transformasjon",
            type: "STUDY",
            finesInfo: "",
            finesActivated: false,
        },
    ]);

    const [bachelor] = await ctx.db
        .insert(schema.studyProgram)
        .values({
            slug: "dataingenir",
            feideCode: "BIDATA",
            displayName: "Dataingeniør",
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

    const event = await ctx.utils.createTestEvent({ capacity: 1 });
    await ctx.db.insert(schema.eventPriorityPool).values({
        eventId: event.id,
        groupSlug: "dataingenir",
    });

    return {
        event,
        bachelorId: bachelor?.id as number,
        masterId: master?.id as number,
    };
}

/**
 * A member who finished the bachelor and moved on to the master. Both group
 * memberships stand, because neither is ever removed.
 */
async function createSwitcher(
    ctx: IntegrationTestContext,
    ids: { bachelorId: number; masterId: number },
    bachelorFeideActive: boolean | null,
) {
    const user = await ctx.utils.createTestUser();

    await ctx.db.insert(schema.groupMembership).values([
        { userId: user.id, groupSlug: "dataingenir" },
        { userId: user.id, groupSlug: "digital-samhandling" },
    ]);
    await ctx.db.insert(schema.studyProgramMembership).values([
        {
            userId: user.id,
            studyProgramId: ids.bachelorId,
            startYear: 2023,
            startYearSource: "feide",
            feideActive: bachelorFeideActive,
        },
        {
            userId: user.id,
            studyProgramId: ids.masterId,
            startYear: 2026,
            startYearSource: "derived",
            feideActive: true,
        },
    ]);

    return user;
}

describe("Priority pools and the study a member has left", () => {
    integrationTest(
        "hands the spot to the student over the one who moved to the master",
        async ({ ctx }) => {
            const { event, bachelorId, masterId } =
                await seedBachelorPoolEvent(ctx);

            // Signs up first, so FIFO gives them the only spot — and under the
            // old rule the stale group membership kept them in it.
            const switcher = await createSwitcher(
                ctx,
                { bachelorId, masterId },
                false,
            );
            await ctx.utils.createPendingRegistration(event.id, switcher.id);
            await resolveRegistrationsForEvent(event.id, ctx);

            // Signs up second, and is actually on the programme the pool names.
            const student = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.groupMembership).values({
                userId: student.id,
                groupSlug: "dataingenir",
            });
            await ctx.db.insert(schema.studyProgramMembership).values({
                userId: student.id,
                studyProgramId: bachelorId,
                startYear: 2025,
                startYearSource: "feide",
                feideActive: true,
            });
            await ctx.utils.createPendingRegistration(event.id, student.id);
            await resolveRegistrationsForEvent(event.id, ctx);

            const rows = await ctx.db.query.eventRegistration.findMany({
                where: (r, { eq }) => eq(r.eventId, event.id),
            });
            const statusOf = (userId: string) =>
                rows.find((r) => r.userId === userId)?.status;

            expect(statusOf(student.id)).toBe("registered");
            expect(statusOf(switcher.id)).toBe("waitlisted");
        },
        500_000,
    );

    integrationTest(
        "leaves the spot alone when Feide never answered for the bachelor",
        async ({ ctx }) => {
            const { event, bachelorId, masterId } =
                await seedBachelorPoolEvent(ctx);

            // Same member, same two groups — but the bachelor was never
            // checked against Feide. Most of the organization looks like this,
            // and a missing answer must not cost anyone their place.
            const unchecked = await createSwitcher(
                ctx,
                { bachelorId, masterId },
                null,
            );
            await ctx.utils.createPendingRegistration(event.id, unchecked.id);
            await resolveRegistrationsForEvent(event.id, ctx);

            const student = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.groupMembership).values({
                userId: student.id,
                groupSlug: "dataingenir",
            });
            await ctx.db.insert(schema.studyProgramMembership).values({
                userId: student.id,
                studyProgramId: bachelorId,
                startYear: 2025,
                startYearSource: "feide",
                feideActive: true,
            });
            await ctx.utils.createPendingRegistration(event.id, student.id);
            await resolveRegistrationsForEvent(event.id, ctx);

            const rows = await ctx.db.query.eventRegistration.findMany({
                where: (r, { eq }) => eq(r.eventId, event.id),
            });
            const statusOf = (userId: string) =>
                rows.find((r) => r.userId === userId)?.status;

            // Both are prioritized, so the spot stays with whoever was first.
            expect(statusOf(unchecked.id)).toBe("registered");
            expect(statusOf(student.id)).toBe("waitlisted");
        },
        500_000,
    );
});
