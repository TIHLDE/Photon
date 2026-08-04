import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import type { IntegrationTestContext } from "~/test/config/integration";
import { integrationTest } from "~/test/config/integration";

/**
 * An unanswered evaluation blocks every new registration.
 *
 * This is the only thing that makes an evaluation mandatory in practice, and
 * the reason a bedpres gets answers from the people who actually attended
 * rather than from whoever felt like it. Ported from Lepton.
 */

/** Attaches an evaluation form to `eventId` and returns its form id. */
const addEvaluation = async (
    db: IntegrationTestContext["db"],
    eventId: string,
    title = "Evaluering",
) => {
    const [form] = await db
        .insert(schema.form)
        .values({ title, isTemplate: false })
        .returning();

    if (!form) throw new Error("Failed to create form");

    await db.insert(schema.formEventForm).values({
        formId: form.id,
        eventId,
        type: "evaluation",
    });

    return form.id;
};

const markAttended = async (
    db: IntegrationTestContext["db"],
    eventId: string,
    userId: string,
) => {
    await db
        .insert(schema.eventRegistration)
        .values({ eventId, userId, status: "attended" })
        .onConflictDoUpdate({
            target: [
                schema.eventRegistration.userId,
                schema.eventRegistration.eventId,
            ],
            set: { status: "attended" },
        });
};

describe("unanswered evaluations block registration", () => {
    integrationTest(
        "refuses a new registration and names the event",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const attended = await ctx.utils.createTestEvent({
                title: "Bedpres med Bekk",
                slug: `bedpres-bekk-${Date.now()}`,
            });
            const next = await ctx.utils.createTestEvent({
                title: "Neste arrangement",
                slug: `neste-${Date.now()}`,
            });

            const user = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(user, [
                "events:registrations:create",
            ]);
            await ctx.utils.acceptEventRules(user.id);
            const client = await ctx.utils.clientForUser(user);

            await addEvaluation(ctx.db, attended.id);
            await markAttended(ctx.db, attended.id, user.id);

            const response = await client.api.event[
                ":eventId"
            ].registration.$post({
                param: { eventId: next.id },
                json: {},
            });

            expect(response.status).toBe(403);
            const json = (await response.json()) as unknown as {
                message: string;
            };
            expect(json.message).toContain("Bedpres med Bekk");

            const rows = await ctx.db.query.eventRegistration.findMany({
                where: (reg, { eq }) => eq(reg.eventId, next.id),
            });
            expect(rows).toHaveLength(0);
        },
        500_000,
    );

    integrationTest(
        "lets the same member register once the evaluation is answered",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const attended = await ctx.utils.createTestEvent({
                title: "Bedpres",
                slug: `bedpres-${Date.now()}`,
            });
            const next = await ctx.utils.createTestEvent({
                title: "Neste",
                slug: `neste-2-${Date.now()}`,
            });

            const user = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(user, [
                "events:registrations:create",
            ]);
            await ctx.utils.acceptEventRules(user.id);
            const client = await ctx.utils.clientForUser(user);

            const formId = await addEvaluation(ctx.db, attended.id);
            await markAttended(ctx.db, attended.id, user.id);

            const blocked = await client.api.event[
                ":eventId"
            ].registration.$post({
                param: { eventId: next.id },
                json: {},
            });
            expect(blocked.status).toBe(403);

            const answered = await client.api.forms[
                ":formId"
            ].submissions.$post({
                param: { formId },
                json: { answers: [] },
            });
            expect(answered.status).toBe(201);

            const response = await client.api.event[
                ":eventId"
            ].registration.$post({
                param: { eventId: next.id },
                json: {},
            });

            expect(response.status).toBe(200);
        },
        500_000,
    );

    integrationTest(
        "ignores an evaluation for an event the member did not attend",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const missed = await ctx.utils.createTestEvent({
                title: "Arrangement de ikke møtte på",
                slug: `missed-${Date.now()}`,
            });
            const next = await ctx.utils.createTestEvent({
                title: "Neste",
                slug: `neste-3-${Date.now()}`,
            });

            const user = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(user, [
                "events:registrations:create",
            ]);
            await ctx.utils.acceptEventRules(user.id);
            const client = await ctx.utils.clientForUser(user);

            await addEvaluation(ctx.db, missed.id);
            // Registered, never marked as attended — there is nothing for them
            // to evaluate, and the submission route would refuse the answer.
            await ctx.db.insert(schema.eventRegistration).values({
                eventId: missed.id,
                userId: user.id,
                status: "registered",
            });

            const response = await client.api.event[
                ":eventId"
            ].registration.$post({
                param: { eventId: next.id },
                json: {},
            });

            expect(response.status).toBe(200);
        },
        500_000,
    );

    integrationTest(
        "a survey form does not block anything",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const attended = await ctx.utils.createTestEvent({
                title: "Med påmeldingsskjema",
                slug: `survey-${Date.now()}`,
            });
            const next = await ctx.utils.createTestEvent({
                title: "Neste",
                slug: `neste-4-${Date.now()}`,
            });

            const user = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(user, [
                "events:registrations:create",
            ]);
            await ctx.utils.acceptEventRules(user.id);
            const client = await ctx.utils.clientForUser(user);

            const [form] = await ctx.db
                .insert(schema.form)
                .values({ title: "Påmelding", isTemplate: false })
                .returning();
            await ctx.db.insert(schema.formEventForm).values({
                formId: form?.id ?? "",
                eventId: attended.id,
                type: "survey",
            });
            await markAttended(ctx.db, attended.id, user.id);

            const response = await client.api.event[
                ":eventId"
            ].registration.$post({
                param: { eventId: next.id },
                json: {},
            });

            expect(response.status).toBe(200);
        },
        500_000,
    );

    integrationTest(
        "lists the unanswered evaluation on the member's own endpoint",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const attended = await ctx.utils.createTestEvent({
                title: "Bedpres med Knowit",
                slug: `knowit-${Date.now()}`,
            });

            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            const formId = await addEvaluation(ctx.db, attended.id);
            await markAttended(ctx.db, attended.id, user.id);

            const response =
                await client.api.user.me["unanswered-evaluations"].$get();

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body).toHaveLength(1);
            expect(body[0]?.formId).toBe(formId);
            expect(body[0]?.eventTitle).toBe("Bedpres med Knowit");

            // And it disappears once answered.
            await ctx.db.insert(schema.formSubmission).values({
                formId,
                userId: user.id,
            });

            const after =
                await client.api.user.me["unanswered-evaluations"].$get();
            expect(await after.json()).toHaveLength(0);

            const submissions = await ctx.db
                .select()
                .from(schema.formSubmission)
                .where(
                    and(
                        eq(schema.formSubmission.formId, formId),
                        eq(schema.formSubmission.userId, user.id),
                    ),
                );
            expect(submissions).toHaveLength(1);
        },
        500_000,
    );
});
