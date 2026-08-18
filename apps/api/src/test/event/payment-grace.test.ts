import { PAYMENT_QUEUE_NAME } from "@photon/core/services/queue";
import { describe, expect } from "vitest";
import { DEFAULT_PAYMENT_GRACE_MINUTES } from "~/lib/event/payment";
import { resolveRegistrationsForEvent } from "~/lib/event/resolve-registration";
import { integrationTest } from "~/test/config/integration";

/**
 * The payment deadline is only as real as the number the event carries. These
 * tests walk the exact path Kvark's admin pages take — create with no grace
 * period, read the event back, save it again — and assert that what comes out
 * the other end can still enforce a deadline.
 *
 * Production had 0 on every paid event, which silently disables the deadline
 * entirely: no obligation row, no countdown, no reclaimed spot.
 */
const KVARK_CREATE_BODY = {
    title: "Betalt arrangement",
    description: "Opprettet slik Kvark gjør det",
    categorySlug: "bedpres",
    organizerGroupSlug: "index",
    location: "Trondheim",
    imageUrl: null,
    start: "2026-12-01T18:00:00Z",
    end: "2026-12-01T20:00:00Z",
    registrationStart: null,
    registrationEnd: "2026-11-30T23:59:59Z",
    cancellationDeadline: null,
    capacity: 50,
    isRegistrationClosed: false,
    requiresSigningUp: true,
    allowWaitlist: true,
    priorityPools: null,
    onlyAllowPrioritized: false,
    canCauseStrikes: false,
    enforcesPreviousStrikes: false,
    isPaidEvent: true,
    price: 200,
    // Exactly what apps/kvark/src/routes/admin/arrangementer.ny.tsx sends.
    contactPersonUserId: null,
    reactionsAllowed: true,
} as const;

describe("betalingsfrist på betalte arrangementer", () => {
    integrationTest(
        "an event created the way Kvark creates it can enforce a deadline",
        async ({ ctx }) => {
            const admin = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(admin);
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();
            await ctx.utils.giveUserPermissions(admin, [
                "events:create",
                "events:update",
            ]);

            const created = await client.api.event.$post({
                json: KVARK_CREATE_BODY,
            });
            expect(created.status).toBe(201);
            const { eventId } = await created.json();

            // 1. What the admin page reads back is what it will send again.
            const detail = await client.api.event[":eventId"].$get({
                param: { eventId },
            });
            expect(detail.status).toBe(200);
            const event = await detail.json();
            if (typeof event === "string") throw new Error(event);
            const graceFromApi = event.payInfo?.paymentGracePeriodMinutes;

            // The same constant for every event — never a 0, which is what
            // used to disable the deadline entirely.
            expect(graceFromApi).toBe(DEFAULT_PAYMENT_GRACE_MINUTES);

            // 2. Registering must produce an obligation with a real deadline.
            const member = await ctx.utils.createTestUser();
            await ctx.utils.createPendingRegistration(eventId, member.id);
            await resolveRegistrationsForEvent(eventId, ctx);

            const payment = await ctx.db.query.eventPayment.findFirst({
                where: (p, { and, eq }) =>
                    and(eq(p.eventId, eventId), eq(p.userId, member.id)),
            });
            expect(payment?.expiresAt).toBeTruthy();

            const jobs = await ctx.queue.getQueue(PAYMENT_QUEUE_NAME).getJobs();
            expect(jobs).toHaveLength(1);
        },
        500_000,
    );

    integrationTest(
        "the payment deadline cannot be set through the API",
        async ({ ctx }) => {
            /**
             * The deadline is a constant, not a per-event setting. It used to
             * be a column anyone with `events:update` could write, and a `0`
             * there disabled the deadline outright — which is how every paid
             * event in production ended up handing out spots nobody had to pay
             * for. Sending the field must not change anything.
             */
            const admin = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(admin);
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();
            await ctx.utils.giveUserPermissions(admin, [
                "events:create",
                "events:update",
            ]);

            const created = await client.api.event.$post({
                json: KVARK_CREATE_BODY,
            });
            const { eventId } = await created.json();

            const saved = await client.api.event[":id"].$put({
                param: { id: eventId },
                json: {
                    ...KVARK_CREATE_BODY,
                    // Not part of the input schema any more; the type system
                    // rejects it, and the runtime must ignore it.
                    paymentGracePeriodMinutes: 0,
                } as unknown as typeof KVARK_CREATE_BODY,
            });
            expect(saved.status).toBe(200);

            const detail = await client.api.event[":eventId"].$get({
                param: { eventId },
            });
            const event = await detail.json();
            if (typeof event === "string") throw new Error(event);
            expect(event.payInfo?.paymentGracePeriodMinutes).toBe(
                DEFAULT_PAYMENT_GRACE_MINUTES,
            );

            // And a registration still gets the constant, not the 0.
            const member = await ctx.utils.createTestUser();
            await ctx.utils.createPendingRegistration(eventId, member.id);
            await resolveRegistrationsForEvent(eventId, ctx);

            const payment = await ctx.db.query.eventPayment.findFirst({
                where: (p, { and, eq }) =>
                    and(eq(p.eventId, eventId), eq(p.userId, member.id)),
            });
            expect(payment?.expiresAt).toBeTruthy();
        },
        500_000,
    );
});
