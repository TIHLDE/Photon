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

const MINUTE = 60_000;

async function seedFullEvent(ctx: IntegrationTestContext) {
    await ctx.utils.setupEventCategories();

    await ctx.db.insert(schema.group).values({
        slug: "prioritert-gjeng",
        name: "Prioritert gjeng",
        type: "SUBGROUP",
        finesInfo: "",
        finesActivated: false,
    });

    const event = await ctx.utils.createTestEvent({ capacity: 1 });
    await ctx.db.insert(schema.eventPriorityPool).values({
        eventId: event.id,
        groupSlug: "prioritert-gjeng",
    });

    return event;
}

async function addMember(
    ctx: IntegrationTestContext,
    opts: { prioritized: boolean },
) {
    const user = await ctx.utils.createTestUser();
    if (opts.prioritized) {
        await ctx.db.insert(schema.groupMembership).values({
            userId: user.id,
            groupSlug: "prioritert-gjeng",
        });
    }
    return user;
}

const statusOf = async (ctx: IntegrationTestContext, eventId: string) => {
    const rows = await ctx.db.query.eventRegistration.findMany({
        where: (r, { eq }) => eq(r.eventId, eventId),
    });
    return (userId: string) => rows.find((r) => r.userId === userId);
};

describe("A swap frees a spot for the waiting list, not for the newcomer", () => {
    integrationTest(
        "hands the freed spot to the prioritized member who has waited longest",
        async ({ ctx }) => {
            const event = await seedFullEvent(ctx);
            const now = Date.now();

            // Holds the only spot, and is not prioritized — the swap target.
            const seated = await addMember(ctx, { prioritized: false });
            await ctx.db.insert(schema.eventRegistration).values({
                eventId: event.id,
                userId: seated.id,
                status: "registered",
                createdAt: new Date(now),
            });

            // Prioritized, and has been on the waiting list since long before
            // the newcomer showed up. The spot is theirs.
            const waiting = await addMember(ctx, { prioritized: true });
            await ctx.db.insert(schema.eventRegistration).values({
                eventId: event.id,
                userId: waiting.id,
                status: "waitlisted",
                waitlistPosition: 1,
                createdAt: new Date(now + MINUTE),
            });

            // Prioritized too, but signing up last.
            const newcomer = await addMember(ctx, { prioritized: true });
            await ctx.db.insert(schema.eventRegistration).values({
                eventId: event.id,
                userId: newcomer.id,
                status: "pending",
                createdAt: new Date(now + 10 * MINUTE),
            });

            await resolveRegistrationsForEvent(event.id, ctx);

            const status = await statusOf(ctx, event.id);
            expect(status(waiting.id)?.status).toBe("registered");
            expect(status(newcomer.id)?.status).toBe("waitlisted");
            expect(status(seated.id)?.status).toBe("waitlisted");

            const registered = (
                await ctx.db.query.eventRegistration.findMany({
                    where: (r, { eq, and }) =>
                        and(
                            eq(r.eventId, event.id),
                            eq(r.status, "registered"),
                        ),
                })
            ).length;
            expect(registered).toBe(1);
        },
        500_000,
    );

    integrationTest(
        "still seats the newcomer when nobody prioritized is waiting",
        async ({ ctx }) => {
            const event = await seedFullEvent(ctx);
            const now = Date.now();

            const seated = await addMember(ctx, { prioritized: false });
            await ctx.db.insert(schema.eventRegistration).values({
                eventId: event.id,
                userId: seated.id,
                status: "registered",
                createdAt: new Date(now),
            });

            // Waiting, but not prioritized — they never outrank a prioritized
            // member, whenever either of them signed up.
            const waiting = await addMember(ctx, { prioritized: false });
            await ctx.db.insert(schema.eventRegistration).values({
                eventId: event.id,
                userId: waiting.id,
                status: "waitlisted",
                waitlistPosition: 1,
                createdAt: new Date(now + MINUTE),
            });

            const newcomer = await addMember(ctx, { prioritized: true });
            await ctx.db.insert(schema.eventRegistration).values({
                eventId: event.id,
                userId: newcomer.id,
                status: "pending",
                createdAt: new Date(now + 10 * MINUTE),
            });

            await resolveRegistrationsForEvent(event.id, ctx);

            const status = await statusOf(ctx, event.id);
            expect(status(newcomer.id)?.status).toBe("registered");
            expect(status(seated.id)?.status).toBe("waitlisted");
            expect(status(waiting.id)?.status).toBe("waitlisted");
        },
        500_000,
    );
});
