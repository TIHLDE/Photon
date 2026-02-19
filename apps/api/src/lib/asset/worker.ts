import cron from "node-cron";
import type { AppContext } from "~/lib/ctx";
import { deleteAsset, getStagedAssetsForCleanup } from "./index";

/**
 * Number of days after which staged assets are eligible for cleanup
 */
const STAGING_EXPIRY_DAYS = 2;

/**
 * Maximum number of assets to clean up per run
 */
const CLEANUP_BATCH_SIZE = 100;

/**
 * Start the asset cleanup cron job
 * Runs every hour at minute 15 to clean up staged assets older than 2 days
 */
export function startAssetCleanupCron(ctx: AppContext): void {
    // Run at minute 15 of every hour
    cron.schedule("15 * * * *", async () => {
        try {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - STAGING_EXPIRY_DAYS);

            const assets = await getStagedAssetsForCleanup(
                ctx.db,
                cutoff,
                CLEANUP_BATCH_SIZE,
            );

            if (assets.length === 0) {
                return;
            }

            console.log(
                `🧹 Cleaning up ${assets.length} staged asset(s) older than ${STAGING_EXPIRY_DAYS} days`,
            );

            let deleted = 0;
            let failed = 0;

            for (const asset of assets) {
                try {
                    await deleteAsset(ctx.bucket, asset.key);
                    deleted++;
                } catch (error) {
                    failed++;
                    console.error(
                        `Failed to delete asset ${asset.key}:`,
                        error,
                    );
                }
            }

            console.log(
                `✅ Asset cleanup complete: ${deleted} deleted, ${failed} failed`,
            );
        } catch (error) {
            console.error("Error in asset cleanup cron:", error);
        }
    });

    console.log("⏰ Asset cleanup cron started (runs hourly at :15)");
}
