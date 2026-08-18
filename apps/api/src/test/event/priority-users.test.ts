import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { resolveRegistrationsForEvent } from "~/lib/event/resolve-registration";
import { integrationTest } from "~/test/config/integration";

/**
 * Enkeltpersoner prioritert ved navn, ved siden av gruppene i poolene.
 *
 * Regelen er flat der poolene er sammensatte: står du i lista, er du
 * prioritert, uten at noen gruppe må stemme. Testene under fester de tre
 * stedene det avgjøres — bytte om plassen på et fullt arrangement, «bare
 * prioriterte» ved påmelding, og prikkegrensa, som gjelder her også.
 */
describe("individually prioritized users", () => {
    integrationTest(
        "a named individual swaps into a full event",
        async ({ ctx }) => {
            await ctx.utils.setupEventCategories();
            await ctx.utils.setupGroups();

            const event = await ctx.utils.createTestEvent({ capacity: 1 });

            const ordinary = await ctx.utils.createTestUser();
            const named = await ctx.utils.createTestUser();

            // Prioritert uten å være med i en eneste gruppe: det er nettopp
            // dette navngivningen skal kunne.
            await ctx.db.insert(schema.eventPriorityUser).values({
                eventId: event.id,
                userId: named.id,
            });

            await ctx.utils.createPendingRegistration(event.id, ordinary.id);
            await resolveRegistrationsForEvent(event.id, ctx);

            await ctx.utils.createPendingRegistration(event.id, named.id);
            await resolveRegistrationsForEvent(event.id, ctx);

            const namedReg = await ctx.db.query.eventRegistration.findFirst({
                where: (reg, { and, eq }) =>
                    and(eq(reg.eventId, event.id), eq(reg.userId, named.id)),
            });
            const ordinaryReg = await ctx.db.query.eventRegistration.findFirst({
                where: (reg, { and, eq }) =>
                    and(eq(reg.eventId, event.id), eq(reg.userId, ordinary.id)),
            });

            expect(namedReg?.status).toBe("registered");
            expect(ordinaryReg?.status).toBe("waitlisted");
        },
        500_000,
    );

    integrationTest(
        "three strikes still block a named individual",
        async ({ ctx }) => {
            await ctx.utils.setupEventCategories();
            await ctx.utils.setupGroups();

            const event = await ctx.utils.createTestEvent({
                capacity: 1,
                enforcesPreviousStrikes: true,
            });

            const ordinary = await ctx.utils.createTestUser();
            const named = await ctx.utils.createTestUser();

            await ctx.db.insert(schema.eventPriorityUser).values({
                eventId: event.id,
                userId: named.id,
            });
            await ctx.db.insert(schema.eventStrike).values({
                eventId: event.id,
                userId: named.id,
                count: 3,
                reason: "Test",
            });

            await ctx.utils.createPendingRegistration(event.id, ordinary.id);
            await resolveRegistrationsForEvent(event.id, ctx);

            await ctx.utils.createPendingRegistration(event.id, named.id);
            await resolveRegistrationsForEvent(event.id, ctx);

            const namedReg = await ctx.db.query.eventRegistration.findFirst({
                where: (reg, { and, eq }) =>
                    and(eq(reg.eventId, event.id), eq(reg.userId, named.id)),
            });
            const ordinaryReg = await ctx.db.query.eventRegistration.findFirst({
                where: (reg, { and, eq }) =>
                    and(eq(reg.eventId, event.id), eq(reg.userId, ordinary.id)),
            });

            // Prikkene slår inn før prioriteringen: den navngitte tar ikke
            // plassen fra noen. (Selve statusen er `cancelled`, fordi tre
            // prikker også utsetter påmeldingstidspunktet — se
            // `canRegisterBasedOnStrikes`.)
            expect(namedReg?.status).not.toBe("registered");
            expect(ordinaryReg?.status).toBe("registered");
        },
        500_000,
    );

    integrationTest(
        "onlyAllowPrioritized admits a named individual and rejects everyone else",
        async ({ ctx }) => {
            await ctx.utils.setupEventCategories();
            await ctx.utils.setupGroups();

            const event = await ctx.utils.createTestEvent({
                capacity: 10,
                onlyAllowPrioritized: true,
            });

            const named = await ctx.utils.createTestUser();
            const stranger = await ctx.utils.createTestUser();

            await ctx.db.insert(schema.eventPriorityUser).values({
                eventId: event.id,
                userId: named.id,
            });

            for (const user of [named, stranger]) {
                await ctx.utils.giveUserPermissions(user, [
                    "events:registrations:create",
                ]);
                await ctx.utils.acceptEventRules(user.id);
            }

            const namedClient = await ctx.utils.clientForUser(named);
            const namedResponse = await namedClient.api.event[
                ":eventId"
            ].registration.$post({
                param: { eventId: event.id },
                json: {},
            });
            expect(namedResponse.status).toBe(200);

            const strangerClient = await ctx.utils.clientForUser(stranger);
            const strangerResponse = await strangerClient.api.event[
                ":eventId"
            ].registration.$post({
                param: { eventId: event.id },
                json: {},
            });
            expect(strangerResponse.status).toBe(403);
        },
        500_000,
    );

    integrationTest(
        "create stores the named individuals, update replaces them",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const organizer = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(organizer, [
                "events:create",
                "events:update",
            ]);
            const client = await ctx.utils.clientForUser(organizer);

            const first = await ctx.utils.createTestUser();
            const second = await ctx.utils.createTestUser();

            const createResponse = await client.api.event.$post({
                json: {
                    title: "Prioritert arrangement",
                    description: "…",
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
                    // Duplikatet er med med vilje: primærnøkkelen ville
                    // avvist hele arrangementet om det ikke ble luket bort.
                    priorityUserIds: [first.id, first.id],
                    onlyAllowPrioritized: true,
                    canCauseStrikes: false,
                    enforcesPreviousStrikes: false,
                    isPaidEvent: false,
                    price: null,
                    contactPersonUserId: null,
                    reactionsAllowed: true,
                },
            });

            expect(createResponse.status).toBe(201);
            const { eventId } = await createResponse.json();

            const afterCreate = await ctx.db
                .select({ userId: schema.eventPriorityUser.userId })
                .from(schema.eventPriorityUser)
                .where(eq(schema.eventPriorityUser.eventId, eventId));
            expect(afterCreate).toEqual([{ userId: first.id }]);

            const updateResponse = await client.api.event[":id"].$put({
                param: { id: eventId },
                json: { priorityUserIds: [second.id] },
            });
            expect(updateResponse.status).toBe(200);

            const afterUpdate = await ctx.db
                .select({ userId: schema.eventPriorityUser.userId })
                .from(schema.eventPriorityUser)
                .where(eq(schema.eventPriorityUser.eventId, eventId));
            expect(afterUpdate).toEqual([{ userId: second.id }]);

            // Et kall som ikke nevner feltet skal ikke tømme det. Det samme
            // gjelder `null`, som betyr «ikke rør» — nøyaktig som for
            // `priorityPools`. Bare en tom liste tømmer.
            for (const json of [
                { title: "Nytt navn" },
                { priorityUserIds: null },
            ]) {
                const untouched = await client.api.event[":id"].$put({
                    param: { id: eventId },
                    json,
                });
                expect(untouched.status).toBe(200);

                const afterUnrelatedUpdate = await ctx.db
                    .select({ userId: schema.eventPriorityUser.userId })
                    .from(schema.eventPriorityUser)
                    .where(eq(schema.eventPriorityUser.eventId, eventId));
                expect(afterUnrelatedUpdate).toEqual([{ userId: second.id }]);
            }

            const emptied = await client.api.event[":id"].$put({
                param: { id: eventId },
                json: { priorityUserIds: [] },
            });
            expect(emptied.status).toBe(200);

            const afterEmptied = await ctx.db
                .select({ userId: schema.eventPriorityUser.userId })
                .from(schema.eventPriorityUser)
                .where(eq(schema.eventPriorityUser.eventId, eventId));
            expect(afterEmptied).toEqual([]);
        },
        500_000,
    );

    integrationTest(
        "onlyAllowPrioritized is rejected when nobody is prioritized",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const organizer = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(organizer, ["events:create"]);
            const client = await ctx.utils.clientForUser(organizer);

            const response = await client.api.event.$post({
                json: {
                    title: "Stengt for alle",
                    description: "…",
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
                    // En pool uten kriterier matcher ingen: sammen med «bare
                    // prioriterte» stenger den arrangementet for alle.
                    priorityPools: [{ groupSlug: null, classYear: null }],
                    priorityUserIds: [],
                    onlyAllowPrioritized: true,
                    canCauseStrikes: false,
                    enforcesPreviousStrikes: false,
                    isPaidEvent: false,
                    price: null,
                    contactPersonUserId: null,
                    reactionsAllowed: true,
                },
            });

            expect(response.status).toBe(400);
        },
        500_000,
    );

    integrationTest(
        "the named individuals are shown to an editor and hidden from everyone else",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const event = await ctx.utils.createTestEvent({
                organizerGroupSlug: "index",
            });
            const named = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.eventPriorityUser).values({
                eventId: event.id,
                userId: named.id,
            });

            const editor = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(editor, ["events:update"]);
            const editorClient = await ctx.utils.clientForUser(editor);
            const editorResponse = await editorClient.api.event[
                ":eventId"
            ].$get({
                param: { eventId: event.id },
            });
            expect(editorResponse.status).toBe(200);
            const editorJson = await editorResponse.json();
            expect(editorJson).toMatchObject({
                priorityUsers: [{ id: named.id }],
            });

            const member = await ctx.utils.createTestUser();
            const memberClient = await ctx.utils.clientForUser(member);
            const memberResponse = await memberClient.api.event[
                ":eventId"
            ].$get({
                param: { eventId: event.id },
            });
            expect(memberResponse.status).toBe(200);
            const memberJson = await memberResponse.json();
            expect(memberJson).toMatchObject({ priorityUsers: [] });
        },
        500_000,
    );

    integrationTest(
        "an event organizer may search the whole user register",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();

            const organizer = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(organizer, ["events:create"]);
            const client = await ctx.utils.clientForUser(organizer);

            const response = await client.api.user.search.$get({
                query: { q: "Brotherman" },
            });

            expect(response.status).toBe(200);
            const results = await response.json();
            expect(Array.isArray(results)).toBe(true);
        },
        500_000,
    );

    integrationTest(
        "someone without an events permission still cannot search",
        async ({ ctx }) => {
            const nobody = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(nobody);

            const response = await client.api.user.search.$get({
                query: { q: "Brotherman" },
            });

            expect(response.status).toBe(403);
        },
        500_000,
    );
    integrationTest(
        "an unknown user id is rejected with 400, not a failed insert",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const organizer = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(organizer, ["events:create"]);
            const client = await ctx.utils.clientForUser(organizer);

            const response = await client.api.event.$post({
                json: {
                    title: "Ukjent prioritert",
                    description: "…",
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
                    // Nåbart i praksis: arrangøren søker opp noen, brukeren
                    // slettes, og lagringen skjer etterpå.
                    priorityUserIds: ["finnes-ikke"],
                    onlyAllowPrioritized: false,
                    canCauseStrikes: false,
                    enforcesPreviousStrikes: false,
                    isPaidEvent: false,
                    price: null,
                    contactPersonUserId: null,
                    reactionsAllowed: true,
                },
            });

            expect(response.status).toBe(400);

            // Ingenting av arrangementet skal ha overlevd forsøket.
            const events = await ctx.db.query.event.findMany({
                where: (e, { eq }) => eq(e.title, "Ukjent prioritert"),
            });
            expect(events).toEqual([]);
        },
        500_000,
    );

    integrationTest(
        "a leader of another group sees neither the list nor a way to save over it",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const event = await ctx.utils.createTestEvent({
                organizerGroupSlug: "index",
            });
            const named = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.eventPriorityUser).values({
                eventId: event.id,
                userId: named.id,
            });

            // Rettigheten gjelder en annen gruppe enn den som arrangerer.
            const outsider = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.userPermission).values({
                userId: outsider.id,
                permission: "events:update",
                scope: "group:drift",
            });
            const client = await ctx.utils.clientForUser(outsider);

            const read = await client.api.event[":eventId"].$get({
                param: { eventId: event.id },
            });
            expect(read.status).toBe(200);
            expect(await read.json()).toMatchObject({ priorityUsers: [] });

            // Og skrivetilgangen følger lesetilgangen, så den tomme lista
            // ikke kan lagres tilbake over de navngitte.
            const write = await client.api.event[":id"].$put({
                param: { id: event.id },
                json: { priorityUserIds: [] },
            });
            expect(write.status).toBe(403);

            const rows = await ctx.db
                .select({ userId: schema.eventPriorityUser.userId })
                .from(schema.eventPriorityUser)
                .where(eq(schema.eventPriorityUser.eventId, event.id));
            expect(rows).toEqual([{ userId: named.id }]);
        },
        500_000,
    );
    integrationTest(
        "naming someone on a full event moves them to the front of the waitlist",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            // Fullt arrangement med to på venteliste — tilfellet feltet er
            // laget for: plassen er lovet bort etter at påmeldingen stengte.
            const event = await ctx.utils.createTestEvent({
                capacity: 1,
                organizerGroupSlug: "index",
                enforcesPreviousStrikes: false,
            });

            const holder = await ctx.utils.createTestUser();
            const first = await ctx.utils.createTestUser();
            const promised = await ctx.utils.createTestUser();

            for (const user of [holder, first, promised]) {
                await ctx.utils.createPendingRegistration(event.id, user.id);
                await resolveRegistrationsForEvent(event.id, ctx);
            }

            const before = await ctx.db.query.eventRegistration.findFirst({
                where: (reg, { and, eq }) =>
                    and(eq(reg.eventId, event.id), eq(reg.userId, promised.id)),
            });
            expect(before?.status).toBe("waitlisted");
            expect(before?.waitlistPosition).toBe(2);

            const organizer = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(organizer, ["events:update"]);
            const client = await ctx.utils.clientForUser(organizer);

            const response = await client.api.event[":id"].$put({
                param: { id: event.id },
                json: { priorityUserIds: [promised.id] },
            });
            expect(response.status).toBe(200);

            const after = await ctx.db.query.eventRegistration.findMany({
                where: (reg, { and, eq }) =>
                    and(
                        eq(reg.eventId, event.id),
                        eq(reg.status, "waitlisted"),
                    ),
            });

            expect(
                after.find((reg) => reg.userId === promised.id)
                    ?.waitlistPosition,
            ).toBe(1);
            expect(
                after.find((reg) => reg.userId === first.id)?.waitlistPosition,
            ).toBe(2);
        },
        500_000,
    );
});
