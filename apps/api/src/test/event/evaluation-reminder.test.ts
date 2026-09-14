import type { EmailQueueJobData } from "@photon/core/services/email";
import { EMAIL_QUEUE_NAME } from "@photon/core/services/queue";
import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { sendEvaluationRemindersForEndedEvents } from "~/lib/event/evaluation-reminder";
import type { IntegrationTestContext } from "~/test/config/integration";
import { integrationTest } from "~/test/config/integration";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const addEvaluation = async (
    db: IntegrationTestContext["db"],
    eventId: string,
) => {
    const [form] = await db
        .insert(schema.form)
        .values({ title: "Evaluering", isTemplate: false })
        .returning();

    if (!form) throw new Error("Failed to create form");

    await db.insert(schema.formEventForm).values({
        formId: form.id,
        eventId,
        type: "evaluation",
    });

    return form.id;
};

const register = async (
    db: IntegrationTestContext["db"],
    eventId: string,
    userId: string,
    status: "attended" | "registered" | "no_show",
) => {
    await db
        .insert(schema.eventRegistration)
        .values({ eventId, userId, status });
};

/** An event that ended two hours ago. */
const endedEvent = (overrides?: { title?: string }) => ({
    title: overrides?.title ?? "Bedpres med Bekk",
    slug: `evaluering-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    start: new Date(Date.now() - 5 * HOUR),
    end: new Date(Date.now() - 2 * HOUR),
});

describe("evaluation reminders", () => {
    integrationTest(
        "tells attendees to answer the evaluation, once, with a link to the form",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const event = await ctx.utils.createTestEvent(endedEvent());
            const formId = await addEvaluation(ctx.db, event.id);

            const attendee = await ctx.utils.createTestUser();
            const noShow = await ctx.utils.createTestUser();
            await register(ctx.db, event.id, attendee.id, "attended");
            await register(ctx.db, event.id, noShow.id, "no_show");

            await sendEvaluationRemindersForEndedEvents(ctx);

            const notifications = await ctx.db
                .select()
                .from(schema.notification);

            expect(notifications).toHaveLength(1);
            expect(notifications[0]?.userId).toBe(attendee.id);
            expect(notifications[0]?.title).toBe("Svar på evalueringen");
            expect(notifications[0]?.description).toContain("Bedpres med Bekk");
            expect(notifications[0]?.link).toBe(`/sporreskjema/${formId}`);

            const emails = await ctx.queue
                .getQueue<EmailQueueJobData>(EMAIL_QUEUE_NAME)
                .getJobs();
            expect(emails).toHaveLength(1);
            const content = emails[0]?.data.content;
            if (!content || content.type !== "html") {
                throw new Error("Expected queued email content to be HTML");
            }
            expect(content.html).toContain("Bedpres med Bekk");
            expect(content.html).toContain(`/sporreskjema/${formId}`);

            // A second sweep must not remind anyone again.
            await sendEvaluationRemindersForEndedEvents(ctx);
            expect(
                await ctx.db.select().from(schema.notification),
            ).toHaveLength(1);
        },
        500_000,
    );

    integrationTest(
        "leaves alone events still running, events without an evaluation, and members who answered",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const user = await ctx.utils.createTestUser();

            // Ended, but nobody attached an evaluation.
            const withoutForm = await ctx.utils.createTestEvent(endedEvent());
            await register(ctx.db, withoutForm.id, user.id, "attended");

            // Has an evaluation, but has not ended yet.
            const upcoming = await ctx.utils.createTestEvent({
                slug: `evaluering-kommende-${Date.now()}`,
                start: new Date(Date.now() + DAY),
                end: new Date(Date.now() + DAY + 2 * HOUR),
            });
            await addEvaluation(ctx.db, upcoming.id);
            await register(ctx.db, upcoming.id, user.id, "attended");

            // Ended with an evaluation the member already answered.
            const answered = await ctx.utils.createTestEvent(endedEvent());
            const answeredFormId = await addEvaluation(ctx.db, answered.id);
            await register(ctx.db, answered.id, user.id, "attended");
            await ctx.db.insert(schema.formSubmission).values({
                formId: answeredFormId,
                userId: user.id,
            });

            await sendEvaluationRemindersForEndedEvents(ctx);

            expect(
                await ctx.db.select().from(schema.notification),
            ).toHaveLength(0);

            // The answered registration is stamped anyway, so later sweeps
            // stop looking at it.
            const [stamped] = await ctx.db
                .select()
                .from(schema.eventRegistration)
                .where(
                    and(
                        eq(schema.eventRegistration.eventId, answered.id),
                        eq(schema.eventRegistration.userId, user.id),
                    ),
                );
            expect(stamped?.evaluationReminderSentAt).not.toBeNull();
        },
        500_000,
    );

    integrationTest(
        "reminds someone checked in after the first sweep has run",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const event = await ctx.utils.createTestEvent(endedEvent());
            await addEvaluation(ctx.db, event.id);

            const early = await ctx.utils.createTestUser();
            const late = await ctx.utils.createTestUser();
            await register(ctx.db, event.id, early.id, "attended");
            await register(ctx.db, event.id, late.id, "registered");

            await sendEvaluationRemindersForEndedEvents(ctx);
            expect(
                await ctx.db.select().from(schema.notification),
            ).toHaveLength(1);

            // Attendance is often registered long after the doors closed.
            await ctx.db
                .update(schema.eventRegistration)
                .set({ status: "attended" })
                .where(
                    and(
                        eq(schema.eventRegistration.eventId, event.id),
                        eq(schema.eventRegistration.userId, late.id),
                    ),
                );

            await sendEvaluationRemindersForEndedEvents(ctx);

            const notifications = await ctx.db
                .select()
                .from(schema.notification);
            expect(notifications).toHaveLength(2);
            expect(notifications.map((n) => n.userId).sort()).toEqual(
                [early.id, late.id].sort(),
            );
        },
        500_000,
    );

    integrationTest(
        "ignores events that ended longer ago than the block window",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const old = await ctx.utils.createTestEvent({
                slug: `evaluering-gammel-${Date.now()}`,
                start: new Date(Date.now() - 40 * DAY),
                end: new Date(Date.now() - 40 * DAY + 2 * HOUR),
            });
            await addEvaluation(ctx.db, old.id);

            const user = await ctx.utils.createTestUser();
            await register(ctx.db, old.id, user.id, "attended");

            await sendEvaluationRemindersForEndedEvents(ctx);

            expect(
                await ctx.db.select().from(schema.notification),
            ).toHaveLength(0);
        },
        500_000,
    );
});
