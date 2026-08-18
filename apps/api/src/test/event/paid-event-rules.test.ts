import { schema } from "@photon/db";
import { describe, expect } from "vitest";
import { processEventNoShows } from "~/lib/event/no-show";
import { integrationTest } from "~/test/config/integration";
import type { IntegrationTestContext } from "~/test/config/integration";

const HOUR = 60 * 60 * 1000;

/**
 * To faste regler for betalte arrangementer:
 * - de gir aldri prikker, verken for sen avmelding eller no-show
 * - en plass man har betalt for kan ikke meldes av
 */

async function strikeTotal(
    ctx: IntegrationTestContext,
    eventId: string,
    userId: string,
) {
    const rows = await ctx.db.query.eventStrike.findMany({
        where: (s, { and, eq }) =>
            and(eq(s.userId, userId), eq(s.eventId, eventId)),
    });
    return rows.reduce((total, r) => total + r.count, 0);
}

/** Standardkroppen til POST /event, med feltene testen bryr seg om overstyrt. */
function createEventBody(overrides: Record<string, unknown>) {
    return {
        title: "Test Event",
        description: "A test event description",
        categorySlug: "bedpres",
        organizerGroupSlug: "index",
        location: "Oslo, Norway",
        imageUrl: null,
        start: "2025-12-01T18:00:00Z",
        end: "2025-12-01T20:00:00Z",
        registrationStart: null,
        registrationEnd: "2025-11-30T23:59:59Z",
        cancellationDeadline: null,
        capacity: 50,
        isRegistrationClosed: false,
        requiresSigningUp: true,
        allowWaitlist: true,
        priorityPools: null,
        onlyAllowPrioritized: false,
        canCauseStrikes: false,
        enforcesPreviousStrikes: false,
        isPaidEvent: false,
        price: null,
        contactPersonUserId: null,
        reactionsAllowed: true,
        ...overrides,
    };
}

describe("Paid event rules", () => {
    integrationTest(
        "a paid event cannot be created with canCauseStrikes",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();
            await ctx.utils.giveUserPermissions(user, ["events:create"]);

            const response = await client.api.event.$post({
                // biome-ignore lint: testen sender med vilje en ugyldig kropp
                json: createEventBody({
                    isPaidEvent: true,
                    price: 100,
                    canCauseStrikes: true,
                }) as never,
            });

            expect(response.status).toBe(400);
        },
        500_000,
    );

    integrationTest(
        "a paid event cannot be created with a cancellation deadline",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();
            await ctx.utils.giveUserPermissions(user, ["events:create"]);

            const response = await client.api.event.$post({
                json: createEventBody({
                    isPaidEvent: true,
                    price: 100,
                    cancellationDeadline: "2025-11-30T12:00:00Z",
                }) as never,
            });

            expect(response.status).toBe(400);
        },
        500_000,
    );

    integrationTest(
        "registrationStart must be before registrationEnd",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();
            await ctx.utils.giveUserPermissions(user, ["events:create"]);

            const response = await client.api.event.$post({
                json: createEventBody({
                    registrationStart: "2025-11-30T23:59:59Z",
                    registrationEnd: "2025-11-29T12:00:00Z",
                }) as never,
            });

            expect(response.status).toBe(400);
        },
        500_000,
    );

    integrationTest(
        "a paid registration cannot be cancelled by the user",
        async ({ ctx }) => {
            await ctx.utils.setupEventCategories();
            const now = Date.now();
            const event = await ctx.utils.createTestEvent({
                isPaidEvent: true,
                priceMinor: 10_000,
                start: new Date(now + 3 * HOUR),
                end: new Date(now + 5 * HOUR),
            });
            const user = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.eventRegistration).values({
                eventId: event.id,
                userId: user.id,
                status: "registered",
            });
            await ctx.db.insert(schema.eventPayment).values({
                eventId: event.id,
                userId: user.id,
                amountMinor: 10_000,
                status: "paid",
            });

            const client = await ctx.utils.clientForUser(user);
            const res = await client.api.event[":eventId"].registration.$delete(
                { param: { eventId: event.id } },
            );

            expect(res.status).toBe(400);

            // Registreringen skal fortsatt stå — sjekken kjører før slettingen.
            const registration = await ctx.db.query.eventRegistration.findFirst(
                {
                    where: (r, { and, eq }) =>
                        and(eq(r.eventId, event.id), eq(r.userId, user.id)),
                },
            );
            expect(registration).toBeDefined();
        },
        500_000,
    );

    integrationTest(
        "an unpaid registration on a paid event can still be cancelled",
        async ({ ctx }) => {
            await ctx.utils.setupEventCategories();
            const now = Date.now();
            const event = await ctx.utils.createTestEvent({
                isPaidEvent: true,
                priceMinor: 10_000,
                start: new Date(now + 3 * HOUR),
                end: new Date(now + 5 * HOUR),
            });
            const user = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.eventRegistration).values({
                eventId: event.id,
                userId: user.id,
                status: "registered",
            });
            await ctx.db.insert(schema.eventPayment).values({
                eventId: event.id,
                userId: user.id,
                amountMinor: 10_000,
                status: "pending",
            });

            const client = await ctx.utils.clientForUser(user);
            const res = await client.api.event[":eventId"].registration.$delete(
                { param: { eventId: event.id } },
            );

            expect(res.status).toBe(200);
        },
        500_000,
    );

    integrationTest(
        "no late-cancellation strike on a paid event",
        async ({ ctx }) => {
            await ctx.utils.setupEventCategories();
            const now = Date.now();
            // Kombinasjonen avvises av skjemaet i dag, men gamle rader kan ha
            // den — derfor sperren i selve avmeldingen.
            const event = await ctx.utils.createTestEvent({
                canCauseStrikes: true,
                cancellationDeadline: new Date(now - 2 * HOUR),
                isPaidEvent: true,
                priceMinor: 10_000,
                start: new Date(now + HOUR),
                end: new Date(now + 3 * HOUR),
            });
            const user = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.eventRegistration).values({
                eventId: event.id,
                userId: user.id,
                status: "registered",
            });

            const client = await ctx.utils.clientForUser(user);
            const res = await client.api.event[":eventId"].registration.$delete(
                { param: { eventId: event.id } },
            );

            expect(res.status).toBe(200);
            expect(await strikeTotal(ctx, event.id, user.id)).toBe(0);
        },
        500_000,
    );

    integrationTest(
        "no no-show strikes on a paid event",
        async ({ ctx }) => {
            await ctx.utils.setupEventCategories();
            const now = Date.now();
            const event = await ctx.utils.createTestEvent({
                canCauseStrikes: true,
                isPaidEvent: true,
                priceMinor: 10_000,
                start: new Date(now - 3 * HOUR),
                end: new Date(now - HOUR),
            });
            const attendee = await ctx.utils.createTestUser();
            const noShow = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.eventRegistration).values([
                {
                    eventId: event.id,
                    userId: attendee.id,
                    status: "attended",
                },
                {
                    eventId: event.id,
                    userId: noShow.id,
                    status: "registered",
                },
            ]);

            const result = await processEventNoShows(event.id, ctx);

            expect(result).toEqual({ processed: false, struck: 0 });
            expect(await strikeTotal(ctx, event.id, noShow.id)).toBe(0);
        },
        500_000,
    );
});
