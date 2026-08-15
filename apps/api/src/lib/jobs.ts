import { startQueuedEmailWorker } from "@photon/core/services/email";
import cron from "node-cron";
import { startAssetCleanupCron } from "./asset/worker";
import type { AppContext } from "./ctx";
import { processNoShowStrikesForEndedEvents } from "./event/no-show";
import { startPaymentTimerWorker } from "./event/payment";
import { sendUpcomingRegistrationReminders } from "./event/registration-reminder";
import { resolveRegistrationsForEvent } from "./event/resolve-registration";
import { startPushNotificationWorker } from "./notification/push";

/**
 * Start cron job to resolve pending event registrations
 * Runs every 5 seconds to process pending registrations from database
 */
function startRegistrationResolverCron(ctx: AppContext): void {
    // Run every 5 seconds
    cron.schedule("*/5 * * * * *", async () => {
        try {
            // Query database for distinct events with pending registrations
            const eventsWithPending =
                await ctx.db.query.eventRegistration.findMany({
                    where: (reg, { eq }) => eq(reg.status, "pending"),
                    columns: {
                        eventId: true,
                    },
                });

            // Get unique event IDs
            const eventIds = new Set(
                eventsWithPending.map((reg) => reg.eventId),
            );

            // Resolve registrations for each event that has pending registrations
            if (eventIds.size > 0) {
                console.log(
                    `🔄 Processing pending registrations for ${eventIds.size} event(s)`,
                );

                for (const eventId of eventIds) {
                    await resolveRegistrationsForEvent(eventId, ctx);
                }
            }
        } catch (error) {
            console.error("Error in registration resolver cron:", error);
        }
    });

    console.log("⏰ Registration resolver cron started (runs every 5 seconds)");
}

/**
 * Start cron job to issue no-show strikes for events that have ended.
 * Runs every 5 minutes.
 */
function startNoShowStrikeCron(ctx: AppContext): void {
    cron.schedule("*/5 * * * *", async () => {
        try {
            await processNoShowStrikesForEndedEvents(ctx);
        } catch (error) {
            console.error("Error in no-show strike cron:", error);
        }
    });

    console.log("⏰ No-show strike cron started (runs every 5 minutes)");
}

/**
 * Start cron job that reminds favouriters an hour before registration opens.
 * Runs every minute so the reminder lands close to the intended lead time.
 */
function startRegistrationReminderCron(ctx: AppContext): void {
    cron.schedule("* * * * *", async () => {
        try {
            await sendUpcomingRegistrationReminders(ctx);
        } catch (error) {
            console.error("Error in registration reminder cron:", error);
        }
    });

    console.log("⏰ Registration reminder cron started (runs every minute)");
}

/**
 * Initialize all background workers and cron jobs
 * Called once when the application starts
 */
export function startBackgroundJobs(ctx: AppContext): void {
    // Start email worker
    startQueuedEmailWorker(ctx.queue, ctx.emailDelivery);

    // Start payment-deadline countdown worker
    startPaymentTimerWorker(ctx);

    // Start push notification worker
    startPushNotificationWorker(ctx);

    // Start registration resolver cron
    startRegistrationResolverCron(ctx);

    // Start asset cleanup cron
    startAssetCleanupCron(ctx);

    // Start no-show strike cron
    startNoShowStrikeCron(ctx);

    // Start registration-opening reminder cron
    startRegistrationReminderCron(ctx);
}
