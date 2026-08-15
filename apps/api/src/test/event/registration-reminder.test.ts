import type { EmailQueueJobData } from "@photon/core/services/email";
import { EMAIL_QUEUE_NAME } from "@photon/core/services/queue";
import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import {
    sendUpcomingRegistrationReminders,
    formatRegistrationStart,
} from "~/lib/event/registration-reminder";
import { integrationTest } from "~/test/config/integration";

const MINUTE = 60 * 1000;

describe("registration opening reminders", () => {
    integrationTest(
        "notifies favourited users an hour before registration opens, once",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const opensAt = new Date(Date.now() + 50 * MINUTE);
            const event = await ctx.utils.createTestEvent({
                title: "Bedpres med Bekk",
                slug: `reminder-event-${Date.now()}`,
                registrationStart: opensAt,
            });

            const favouriter = await ctx.utils.createTestUser();
            const bystander = await ctx.utils.createTestUser();

            await ctx.db.insert(schema.eventFavorite).values({
                eventId: event.id,
                userId: favouriter.id,
            });

            await sendUpcomingRegistrationReminders(ctx);

            const notifications = await ctx.db
                .select()
                .from(schema.notification);

            expect(notifications).toHaveLength(1);
            expect(notifications[0]?.userId).toBe(favouriter.id);
            expect(notifications[0]?.title).toBe("Påmeldingen åpner snart");
            expect(notifications[0]?.description).toContain(
                formatRegistrationStart(opensAt),
            );
            expect(notifications[0]?.link).toBe(`/arrangementer/${event.slug}`);

            // The user who never favourited the event hears nothing.
            expect(notifications.some((n) => n.userId === bystander.id)).toBe(
                false,
            );

            const emails = await ctx.queue
                .getQueue<EmailQueueJobData>(EMAIL_QUEUE_NAME)
                .getJobs();
            expect(emails).toHaveLength(1);
            const content = emails[0]?.data.content;
            if (!content || content.type !== "html") {
                throw new Error("Expected queued email content to be HTML");
            }
            expect(content.html).toContain("Bedpres med Bekk");
            expect(content.html).toContain("Påmeldingen åpner snart");

            // A second sweep must not send the reminder again.
            await sendUpcomingRegistrationReminders(ctx);
            expect(
                await ctx.db.select().from(schema.notification),
            ).toHaveLength(1);
        },
        500_000,
    );

    integrationTest(
        "leaves alone events opening later than the lead time, and past openings",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const user = await ctx.utils.createTestUser();

            const later = await ctx.utils.createTestEvent({
                slug: `reminder-later-${Date.now()}`,
                registrationStart: new Date(Date.now() + 90 * MINUTE),
            });
            const past = await ctx.utils.createTestEvent({
                slug: `reminder-past-${Date.now()}`,
                registrationStart: new Date(Date.now() - 5 * MINUTE),
            });

            await ctx.db.insert(schema.eventFavorite).values([
                { eventId: later.id, userId: user.id },
                { eventId: past.id, userId: user.id },
            ]);

            await sendUpcomingRegistrationReminders(ctx);

            expect(
                await ctx.db.select().from(schema.notification),
            ).toHaveLength(0);

            // The far-off event stays unclaimed so a later sweep can pick it up.
            const [stillPending] = await ctx.db
                .select()
                .from(schema.event)
                .where(eq(schema.event.id, later.id));
            expect(stillPending?.registrationReminderSentAt).toBeNull();
        },
        500_000,
    );

    integrationTest(
        "skips events that do not require signing up or have registration closed",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const user = await ctx.utils.createTestUser();
            const opensAt = new Date(Date.now() + 30 * MINUTE);

            const noSignUp = await ctx.utils.createTestEvent({
                slug: `reminder-no-signup-${Date.now()}`,
                registrationStart: opensAt,
                requiresSigningUp: false,
            });
            const closed = await ctx.utils.createTestEvent({
                slug: `reminder-closed-${Date.now()}`,
                registrationStart: opensAt,
                isRegistrationClosed: true,
            });

            await ctx.db.insert(schema.eventFavorite).values([
                { eventId: noSignUp.id, userId: user.id },
                { eventId: closed.id, userId: user.id },
            ]);

            await sendUpcomingRegistrationReminders(ctx);

            expect(
                await ctx.db.select().from(schema.notification),
            ).toHaveLength(0);
        },
        500_000,
    );
});
