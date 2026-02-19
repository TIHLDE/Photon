import { startEmailWorker } from "@photon/email/worker";
import cron from "node-cron";
import { startAssetCleanupCron } from "./asset/worker";
import type { AppContext } from "./ctx";
import { resolveRegistrationsForEvent } from "./event/resolve-registration";

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
 * Initialize all background workers and cron jobs
 * Called once when the application starts
 */
export function startBackgroundJobs(ctx: AppContext): void {
    // Start email worker
    startEmailWorker(ctx);

    // Start registration resolver cron
    startRegistrationResolverCron(ctx);

    // Start asset cleanup cron
    startAssetCleanupCron(ctx);
}
