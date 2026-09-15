import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

/**
 * Hvem som kommer med i svarlista til et arrangement-skjema.
 *
 * Lista filtrerte på statusen `registered` alene. Et evalueringsskjema kan
 * bare besvares av dem som er huket av som ankommet, og da står de som
 * `attended` — så hvert eneste evalueringssvar forsvant ut av både svarlista
 * og CSV-en, mens statistikkfanen viste dem. I prod gjaldt det 165 skjemaer
 * og 6564 svar.
 */
describe("Event form submission visibility", () => {
    integrationTest(
        "shows submissions from attendees and hides the waitlist",
        async ({ ctx }) => {
            const organizer = await ctx.utils.createTestUser();
            const attendee = await ctx.utils.createTestUser();
            const waitlisted = await ctx.utils.createTestUser();

            await ctx.utils.giveUserPermissions(organizer, ["events:create"]);
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            await ctx.db.insert(schema.groupMembership).values({
                userId: organizer.id,
                groupSlug: "index",
                role: "leader",
            });

            const organizerClient = await ctx.utils.clientForUser(organizer);
            const attendeeClient = await ctx.utils.clientForUser(attendee);

            const eventResponse = await organizerClient.api.event.$post({
                json: {
                    title: "Bedpres",
                    description: "Event with evaluation",
                    categorySlug: "bedpres",
                    organizerGroupSlug: "index",
                    location: "Trondheim",
                    imageUrl: null,
                    start: "2025-12-01T18:00:00Z",
                    end: "2025-12-01T20:00:00Z",
                    registrationStart: "2025-11-01T00:00:00Z",
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
                },
            });

            const event = await eventResponse.json();
            const eventId = event.eventId;

            const evalResponse = await organizerClient.api.event[
                ":eventId"
            ].forms.$post({
                param: { eventId },
                json: {
                    title: "Evaluation",
                    type: "evaluation",
                    event: eventId,
                    template: false,
                    fields: [
                        {
                            title: "Rating",
                            type: "single_select",
                            required: true,
                            order: 0,
                            options: [
                                { title: "Good", order: 0 },
                                { title: "Bad", order: 1 },
                            ],
                        },
                    ],
                },
            });

            const evaluation = await evalResponse.json();
            const formId = evaluation.id!;
            const fieldId = evaluation.fields?.[0]?.id!;
            const optionId = evaluation.fields?.[0]?.options?.[0]?.id!;

            await ctx.db.insert(schema.eventRegistration).values([
                { eventId, userId: attendee.id, status: "attended" },
                { eventId, userId: waitlisted.id, status: "waitlisted" },
            ]);

            const submitResponse = await attendeeClient.api.forms[
                ":formId"
            ].submissions.$post({
                param: { formId },
                json: {
                    answers: [
                        {
                            field: { id: fieldId },
                            selected_options: [{ id: optionId }],
                        },
                    ],
                },
            });

            expect(submitResponse.status).toBe(201);

            // Ventelista slipper ikke gjennom evalueringsporten, så svaret
            // deres må legges inn direkte for å teste filteret.
            await ctx.db.insert(schema.formSubmission).values({
                formId,
                userId: waitlisted.id,
            });

            const listResponse = await organizerClient.api.forms[
                ":formId"
            ].submissions.$get({ param: { formId } });

            expect(listResponse.status).toBe(200);
            const submissions = await listResponse.json();

            expect(submissions).toHaveLength(1);
            expect(submissions[0]?.user.id).toBe(attendee.id);

            // Statistikken teller det samme settet som lista viser: ett svar,
            // ikke to. Ellers spriker «N svar» og prosentene på samme skjema.
            const statsResponse = await organizerClient.api.forms[
                ":id"
            ].statistics.$get({ param: { id: formId } });

            expect(statsResponse.status).toBe(200);
            const stats = await statsResponse.json();

            expect(stats.statistics?.[0]?.options?.[0]?.answer_amount).toBe(1);
            expect(stats.statistics?.[0]?.options?.[0]?.answer_percentage).toBe(
                100,
            );

            const downloadResponse = await organizerClient.api.forms[
                ":formId"
            ].submissions.download.$get({ param: { formId } });

            expect(downloadResponse.status).toBe(200);
            const csv = await downloadResponse.text();

            // Testbrukerne deler navn, så e-posten er det som skiller dem.
            expect(csv).toContain(attendee.email);
            expect(csv).not.toContain(waitlisted.email);
        },
        60_000,
    );
});

/**
 * Hvem som får lese svarene på et arrangement-skjema.
 *
 * Å opprette skjemaet krever `events:update`/`events:manage`, mens det å lese
 * svarene krevde `forms:*`. Gruppenes medlemsrettigheter — NoK, Sosialen,
 * KoK, FadderKom — inneholder bare de første, så komiteen kunne lage
 * evalueringsskjemaet uten å kunne åpne det de fikk inn.
 */
describe("Event form submission access", () => {
    integrationTest(
        "lets the arranging committee read the answers without forms permissions",
        async ({ ctx }) => {
            const leader = await ctx.utils.createTestUser();
            const committee = await ctx.utils.createTestUser();
            const attendee = await ctx.utils.createTestUser();

            await ctx.utils.giveUserPermissions(leader, ["events:create"]);
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            // Slik gruppene faktisk ser ut i prod: arrangement-rettighetene
            // ligger på medlemskapet, ingen `forms:*` noe sted.
            await ctx.db
                .update(schema.group)
                .set({ memberPermissions: ["events:update", "events:manage"] })
                .where(eq(schema.group.slug, "index"));

            await ctx.db.insert(schema.groupMembership).values([
                { userId: leader.id, groupSlug: "index", role: "leader" },
                { userId: committee.id, groupSlug: "index", role: "member" },
            ]);

            const leaderClient = await ctx.utils.clientForUser(leader);
            const committeeClient = await ctx.utils.clientForUser(committee);
            const attendeeClient = await ctx.utils.clientForUser(attendee);

            const eventResponse = await leaderClient.api.event.$post({
                json: {
                    title: "Bedpres",
                    description: "Event with evaluation",
                    categorySlug: "bedpres",
                    organizerGroupSlug: "index",
                    location: "Trondheim",
                    imageUrl: null,
                    start: "2025-12-01T18:00:00Z",
                    end: "2025-12-01T20:00:00Z",
                    registrationStart: "2025-11-01T00:00:00Z",
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
                },
            });

            const event = await eventResponse.json();
            const eventId = event.eventId;

            const evalResponse = await leaderClient.api.event[
                ":eventId"
            ].forms.$post({
                param: { eventId },
                json: {
                    title: "Evaluation",
                    type: "evaluation",
                    event: eventId,
                    template: false,
                    fields: [
                        {
                            title: "Rating",
                            type: "text_answer",
                            required: true,
                            order: 0,
                            options: [],
                        },
                    ],
                },
            });

            const evaluation = await evalResponse.json();
            const formId = evaluation.id!;

            await ctx.db.insert(schema.eventRegistration).values({
                eventId,
                userId: attendee.id,
                status: "attended",
            });

            const submitResponse = await attendeeClient.api.forms[
                ":formId"
            ].submissions.$post({
                param: { formId },
                json: {
                    answers: [
                        {
                            field: { id: evaluation.fields?.[0]?.id! },
                            answer_text: "Bra",
                        },
                    ],
                },
            });

            expect(submitResponse.status).toBe(201);

            const listResponse = await committeeClient.api.forms[
                ":formId"
            ].submissions.$get({ param: { formId } });

            expect(listResponse.status).toBe(200);
            expect(await listResponse.json()).toHaveLength(1);

            // Arrangement-tilgangen gjelder arrangementets eget skjema, ikke
            // gruppens andre skjemaer — de krever fortsatt `forms:*`.
            const [groupForm] = await ctx.db
                .insert(schema.form)
                .values({ title: "Opptak" })
                .returning();

            await ctx.db.insert(schema.formGroupForm).values({
                formId: groupForm!.id,
                groupSlug: "index",
            });

            const groupFormResponse = await committeeClient.api.forms[
                ":formId"
            ].submissions.$get({ param: { formId: groupForm!.id } });

            expect(groupFormResponse.status).toBe(403);
        },
        60_000,
    );
});
