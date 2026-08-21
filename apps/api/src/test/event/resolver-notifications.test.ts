import { EMAIL_QUEUE_NAME, PUSH_QUEUE_NAME } from "@photon/core/services/queue";
import { describe, expect, vi } from "vitest";
import { resolveRegistrationsForEvent } from "~/lib/event/resolve-registration";
import { integrationTest } from "~/test/config/integration";
import type { IntegrationTestContext } from "~/test/config/integration";

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
 * What a resolved sign-up wave leaves behind for the members in it: a row in
 * the bell, an email on its way, and a push. The flush hands all of them over
 * in one batch now, so this is the test that the batch still carries every
 * channel — and that a push still points at its own notification row.
 */
async function queuedJobs(ctx: IntegrationTestContext, name: "email" | "push") {
    const queue = ctx.queue.getQueue(
        name === "email" ? EMAIL_QUEUE_NAME : PUSH_QUEUE_NAME,
    );
    return await queue.getJobs();
}

describe("Notifications from a resolved batch", () => {
    integrationTest(
        "everyone gets their row, their email and their push",
        async ({ ctx }) => {
            await ctx.utils.setupEventCategories();

            const event = await ctx.utils.createTestEvent({
                title: "Immatrikuleringsball",
                capacity: 2,
            });

            const members = [];
            for (let i = 0; i < 3; i++) {
                const user = await ctx.utils.createTestUser();
                await ctx.utils.createPendingRegistration(event.id, user.id);
                members.push(user);
                // Keep the sign-up order deterministic: the resolver is FIFO on
                // `createdAt`, and three rows written in the same millisecond
                // would leave who gets the last spot to chance.
                await new Promise((resolve) => setTimeout(resolve, 5));
            }

            await resolveRegistrationsForEvent(event.id, ctx);

            const registrations = await ctx.db.query.eventRegistration.findMany(
                {
                    where: (r, { eq }) => eq(r.eventId, event.id),
                },
            );
            expect(
                registrations.filter((r) => r.status === "registered"),
            ).toHaveLength(2);
            expect(
                registrations.filter((r) => r.status === "waitlisted"),
            ).toHaveLength(1);

            const rows = await ctx.db.query.notification.findMany({});
            expect(rows).toHaveLength(3);

            // The two who got a spot, and the one who did not, are each told
            // the thing that happened to them.
            const titles = rows.map((row) => row.title).sort();
            expect(
                titles.filter((t) => t.startsWith("Du er påmeldt")),
            ).toHaveLength(2);
            expect(
                titles.filter((t) => t.startsWith("Du er på venteliste")),
            ).toHaveLength(1);

            // One notification per member, nobody left out and nobody doubled.
            expect(new Set(rows.map((row) => row.userId)).size).toBe(3);

            const emails = await queuedJobs(ctx, "email");
            expect(emails).toHaveLength(3);

            const pushes = (await queuedJobs(ctx, "push")) as Array<{
                data: { userId: string; notificationId: string | null };
            }>;
            expect(pushes).toHaveLength(3);

            // A tap in the app marks the row it came from as read, so the id
            // has to be the one that was actually written.
            const rowIds = new Set(rows.map((row) => row.id));
            for (const push of pushes) {
                expect(push.data.notificationId).not.toBeNull();
                expect(rowIds.has(push.data.notificationId as string)).toBe(
                    true,
                );
                const row = rows.find((r) => r.id === push.data.notificationId);
                expect(row?.userId).toBe(push.data.userId);
            }
        },
        500_000,
    );
});
