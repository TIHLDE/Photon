import { schema } from "@photon/db";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

/**
 * Et besvart spørsmål kan ikke fjernes fra et arrangement-skjema.
 *
 * Vernet fantes, men gjaldt bare gruppeskjemaer: arrangøren skulle få justere
 * påmeldingsskjemaet mens påmeldingen løper. Å endre spørsmålene er fortsatt
 * greit — det er bare det å rydde vekk et spørsmål med svarene sine som
 * stoppes, og et evalueringsskjema får uansett ikke svar før arrangementet er
 * over.
 */
describe("Editing an event form that has answers", () => {
    integrationTest(
        "refuses to remove an answered question, but allows renaming it",
        async ({ ctx }) => {
            const leader = await ctx.utils.createTestUser();
            const attendee = await ctx.utils.createTestUser();

            await ctx.utils.giveUserPermissions(leader, ["events:create"]);
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            await ctx.db.insert(schema.groupMembership).values({
                userId: leader.id,
                groupSlug: "index",
                role: "leader",
            });

            const leaderClient = await ctx.utils.clientForUser(leader);
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
                            title: "Hva synes du?",
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
            const fieldId = evaluation.fields?.[0]?.id!;

            await ctx.db.insert(schema.eventRegistration).values({
                eventId,
                userId: attendee.id,
                status: "attended",
            });

            await attendeeClient.api.forms[":formId"].submissions.$post({
                param: { formId },
                json: {
                    answers: [{ field: { id: fieldId }, answer_text: "Bra" }],
                },
            });

            const removeResponse = await leaderClient.api.forms[":id"].$patch({
                param: { id: formId },
                json: { fields: [] },
            });

            expect(removeResponse.status).toBe(409);

            const renameResponse = await leaderClient.api.forms[":id"].$patch({
                param: { id: formId },
                json: {
                    fields: [
                        {
                            id: fieldId,
                            title: "Hva synes du om bedpresen?",
                            type: "text_answer",
                            required: true,
                            order: 0,
                        },
                    ],
                },
            });

            expect(renameResponse.status).toBe(200);

            const answers = await ctx.db.query.formAnswer.findMany({});
            expect(answers).toHaveLength(1);
        },
        60_000,
    );
});
