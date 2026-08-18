import { startQueuedEmailWorker } from "@photon/core/services/email";
import cron from "node-cron";
import { startAssetCleanupCron } from "./asset/worker";
import type { AppContext } from "./ctx";
import { processNoShowStrikesForEndedEvents } from "./event/no-show";
import { reviewPaymentsForStartedEvents } from "./event/payment-review";
import { startPaymentTimerWorker } from "./event/payment";
import { sendUpcomingRegistrationReminders } from "./event/registration-reminder";
import {
    enqueueRegistrationResolve,
    startRegistrationResolveWorker,
} from "./event/resolve-queue";
import { startPushNotificationWorker } from "./notification/push";

/**
 * Start cron job to resolve pending event registrations
 *
 * Registrations are queued for resolution the moment they are created — see
 * {@link enqueueRegistrationResolve}. This sweep is the safety net for the
 * rows that missed out: an enqueue that failed because Redis was unreachable,
 * an instance that died between the insert and the job, or a row written by
 * something other than the registration route. It runs every 5 seconds and
 * normally finds nothing.
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

            // Hand each event to the same worker the registration route uses,
            // so a sweep never opens a second transaction alongside a pass
            // that is already running.
            if (eventIds.size > 0) {
                console.log(
                    `🔄 Processing pending registrations for ${eventIds.size} event(s)`,
                );

                for (const eventId of eventIds) {
                    await enqueueRegistrationResolve(eventId, ctx);
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
 * Start cron job that asks organisers to review payments made by members who
 * hold no spot, once their event has started. Runs every 5 minutes — the notice
 * is not time-critical, it just has to arrive.
 */
function startPaymentReviewCron(ctx: AppContext): void {
    cron.schedule("*/5 * * * *", async () => {
        try {
            await reviewPaymentsForStartedEvents(ctx);
        } catch (error) {
            console.error("Error in payment review cron:", error);
        }
    });

    console.log("⏰ Payment review cron started (runs every 5 minutes)");
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

    // Start the worker that resolves pending registrations
    startRegistrationResolveWorker(ctx);

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

    // Start the payments-without-a-spot review cron
    startPaymentReviewCron(ctx);
}
