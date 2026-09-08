import { schema } from "@photon/db";
import { describe, expect } from "vitest";
import { processEventNoShows } from "~/lib/event/no-show";
import { resolveRegistrationsForEvent } from "~/lib/event/resolve-registration";
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

            // Uten plassen er det ingenting igjen å betale for. Blir kravet
            // stående som `pending`, lever nedtellingen videre og faller til
            // forfall mot en påmelding brukeren gjør senere.
            const payment = await ctx.db.query.eventPayment.findFirst({
                where: (p, { and, eq }) =>
                    and(eq(p.eventId, event.id), eq(p.userId, user.id)),
            });
            expect(payment?.status).toBe("failed");
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

    integrationTest(
        "prikker utsetter ikke påmeldingen til et betalt arrangement",
        async ({ ctx }) => {
            await ctx.utils.setupEventCategories();

            // Påmeldingen åpnet for en time siden, så to prikker ville krevd
            // tolv timers venting på et gratis arrangement.
            const paid = await ctx.utils.createTestEvent({
                isPaidEvent: true,
                priceMinor: 10_000,
            });
            const free = await ctx.utils.createTestEvent({
                slug: `gratis-${Date.now()}`,
            });

            const user = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.eventStrike).values({
                eventId: free.id,
                userId: user.id,
                count: 2,
                reason: "Test",
            });

            await ctx.utils.createPendingRegistration(paid.id, user.id);
            await resolveRegistrationsForEvent(paid.id, ctx);

            await ctx.utils.createPendingRegistration(free.id, user.id);
            await resolveRegistrationsForEvent(free.id, ctx);

            const onPaid = await ctx.db.query.eventRegistration.findFirst({
                where: (reg, { and, eq }) =>
                    and(eq(reg.eventId, paid.id), eq(reg.userId, user.id)),
            });
            const onFree = await ctx.db.query.eventRegistration.findFirst({
                where: (reg, { and, eq }) =>
                    and(eq(reg.eventId, free.id), eq(reg.userId, user.id)),
            });

            expect(onPaid?.status).toBe("registered");
            expect(onFree?.status).toBe("cancelled");
        },
        500_000,
    );

    integrationTest(
        "et betalt arrangement kan ikke skru på prikker i en senere endring",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();
            await ctx.utils.giveUserPermissions(user, [
                "events:create",
                "events:update",
            ]);

            const created = await client.api.event.$post({
                json: createEventBody({ isPaidEvent: true, price: 100 }),
            });
            expect(created.status).toBe(201);
            const { eventId } = await created.json();

            // Kallet nevner ikke betaling, så skjemaet ser ingen konflikt.
            // Regelen må leses på arrangementet slik det allerede står.
            for (const patch of [
                { enforcesPreviousStrikes: true },
                { canCauseStrikes: true },
                { cancellationDeadline: "2025-11-30T12:00:00Z" },
            ]) {
                const response = await client.api.event[":id"].$put({
                    param: { id: eventId },
                    json: patch as never,
                });
                expect(response.status).toBe(400);
            }

            const stored = await ctx.db.query.event.findFirst({
                where: (e, { eq }) => eq(e.id, eventId),
            });
            expect(stored?.enforcesPreviousStrikes).toBe(false);
            expect(stored?.canCauseStrikes).toBe(false);
            expect(stored?.cancellationDeadline).toBeNull();
        },
        500_000,
    );

    integrationTest(
        "å gjøre et arrangement betalt rydder bort prikkene det hadde",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();
            await ctx.utils.giveUserPermissions(user, [
                "events:create",
                "events:update",
            ]);

            const created = await client.api.event.$post({
                json: createEventBody({
                    canCauseStrikes: true,
                    enforcesPreviousStrikes: true,
                    cancellationDeadline: "2025-11-30T12:00:00Z",
                }),
            });
            expect(created.status).toBe(201);
            const { eventId } = await created.json();

            // Kallet ber ikke om noe ulovlig — det gjør arrangementet betalt,
            // og da har prikkene ingenting der å gjøre lenger.
            const response = await client.api.event[":id"].$put({
                param: { id: eventId },
                json: { isPaidEvent: true, price: 100 },
            });
            expect(response.status).toBe(200);

            const stored = await ctx.db.query.event.findFirst({
                where: (e, { eq }) => eq(e.id, eventId),
            });
            expect(stored?.canCauseStrikes).toBe(false);
            expect(stored?.enforcesPreviousStrikes).toBe(false);
            expect(stored?.cancellationDeadline).toBeNull();
        },
        500_000,
    );

    integrationTest(
        "en urørt endring på et betalt arrangement rydder raden i stedet for å feile",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const user = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(user, ["events:update"]);
            const client = await ctx.utils.clientForUser(user);

            // Raden bærer kombinasjonen fra før — slik testhjelperen og
            // eldre rader gjør det.
            const event = await ctx.utils.createTestEvent({
                slug: `betalt-med-prikker-${Date.now()}`,
                isPaidEvent: true,
                priceMinor: 10_000,
                enforcesPreviousStrikes: true,
            });

            const response = await client.api.event[":id"].$put({
                param: { id: event.id },
                json: { title: "Nytt navn" },
            });
            expect(response.status).toBe(200);

            const stored = await ctx.db.query.event.findFirst({
                where: (e, { eq }) => eq(e.id, event.id),
            });
            expect(stored?.title).toBe("Nytt navn");
            expect(stored?.enforcesPreviousStrikes).toBe(false);
        },
        500_000,
    );

    integrationTest(
        "prikker nedprioriterer ikke på et betalt arrangement med gammelt flagg",
        async ({ ctx }) => {
            await ctx.utils.setupEventCategories();
            await ctx.utils.setupGroups();

            // Kombinasjonen skjemaet nå avviser, lagt rett i basen slik en rad
            // fra før regelen ser ut.
            const event = await ctx.utils.createTestEvent({
                slug: `betalt-gammelt-flagg-${Date.now()}`,
                capacity: 1,
                isPaidEvent: true,
                priceMinor: 10_000,
                enforcesPreviousStrikes: true,
            });

            const striken = await ctx.utils.createTestUser();
            const clean = await ctx.utils.createTestUser();

            await ctx.db.insert(schema.eventPriorityUser).values([
                { eventId: event.id, userId: striken.id },
                { eventId: event.id, userId: clean.id },
            ]);
            await ctx.db.insert(schema.eventStrike).values({
                eventId: event.id,
                userId: striken.id,
                count: 3,
                reason: "Test",
            });

            await ctx.utils.createPendingRegistration(event.id, striken.id);
            await resolveRegistrationsForEvent(event.id, ctx);

            await ctx.utils.createPendingRegistration(event.id, clean.id);
            await resolveRegistrationsForEvent(event.id, ctx);

            const strikenEnd = await ctx.db.query.eventRegistration.findFirst({
                where: (r, { and, eq }) =>
                    and(eq(r.eventId, event.id), eq(r.userId, striken.id)),
            });
            const cleanEnd = await ctx.db.query.eventRegistration.findFirst({
                where: (r, { and, eq }) =>
                    and(eq(r.eventId, event.id), eq(r.userId, clean.id)),
            });

            // Prikkene teller ikke her, så plassen hans står — på et gratis
            // arrangement ville han blitt byttet ut.
            expect(strikenEnd?.status).toBe("registered");
            expect(cleanEnd?.status).toBe("waitlisted");
        },
        500_000,
    );

    integrationTest(
        "et gratis arrangement kan fortsatt skru på prikker",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();
            await ctx.utils.giveUserPermissions(user, [
                "events:create",
                "events:update",
            ]);

            const created = await client.api.event.$post({
                json: createEventBody({}),
            });
            expect(created.status).toBe(201);
            const { eventId } = await created.json();

            const response = await client.api.event[":id"].$put({
                param: { id: eventId },
                json: { enforcesPreviousStrikes: true, canCauseStrikes: true },
            });

            expect(response.status).toBe(200);
        },
        500_000,
    );
});
