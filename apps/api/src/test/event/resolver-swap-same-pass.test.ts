import { schema } from "@photon/db";
import { describe, expect, vi } from "vitest";
import { resolveRegistrationsForEvent } from "~/lib/event/resolve-registration";
import { integrationTest } from "~/test/config/integration";

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
 * The one case where handing out spots in a single write at the end of the pass
 * could go wrong: a member takes the last spot early in the batch, and a
 * prioritised member swaps them out later in the same batch. The demotion is
 * written immediately, so a blind write at the end would put them straight back
 * into a spot that is no longer theirs — two members on a capacity of one.
 */
describe("Swap inside a single resolver pass", () => {
    integrationTest(
        "a member swapped out mid-pass does not get their spot written back",
        async ({ ctx }) => {
            await ctx.utils.setupEventCategories();

            await ctx.db.insert(schema.group).values({
                slug: "prioritert-gjeng",
                name: "Prioritert gjeng",
                type: "SUBGROUP",
                finesInfo: "",
                finesActivated: false,
            });

            const event = await ctx.utils.createTestEvent({
                capacity: 1,
                isPaidEvent: true,
                priceMinor: 51000,
            });

            await ctx.db.insert(schema.eventPriorityPool).values({
                eventId: event.id,
                groupSlug: "prioritert-gjeng",
            });

            // Signs up first, so FIFO gives them the only spot.
            const ordinary = await ctx.utils.createTestUser();
            await ctx.utils.createPendingRegistration(event.id, ordinary.id);

            // Signs up second, but is in the priority pool.
            const prioritised = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.groupMembership).values({
                userId: prioritised.id,
                groupSlug: "prioritert-gjeng",
            });
            await ctx.db.insert(schema.eventRegistration).values({
                eventId: event.id,
                userId: prioritised.id,
                status: "pending",
                createdAt: new Date(Date.now() + 1000),
            });

            // Both are pending, so one pass decides both.
            await resolveRegistrationsForEvent(event.id, ctx);

            const rows = await ctx.db.query.eventRegistration.findMany({
                where: (r, { eq }) => eq(r.eventId, event.id),
            });
            const statusOf = (userId: string) =>
                rows.find((r) => r.userId === userId)?.status;

            expect(statusOf(prioritised.id)).toBe("registered");
            expect(statusOf(ordinary.id)).toBe("waitlisted");
            expect(rows.filter((r) => r.status === "registered")).toHaveLength(
                1,
            );

            // And the one who never kept a spot owes nothing: an obligation
            // with a deadline attached to a waitlist place is a countdown to
            // nothing.
            const payments = await ctx.db.query.eventPayment.findMany({
                where: (p, { eq }) => eq(p.eventId, event.id),
            });
            expect(payments).toHaveLength(1);
            expect(payments[0]?.userId).toBe(prioritised.id);
        },
        500_000,
    );
});
