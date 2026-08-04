import cron from "node-cron";
import type { AppContext } from "~/lib/ctx";
import { deleteAsset, getStagedAssetsForCleanup } from "./index";
import { findAssetReferences } from "./references";

/**
 * Number of days after which staged assets are eligible for cleanup
 */
const STAGING_EXPIRY_DAYS = 2;

/**
 * Maximum number of assets to clean up per run
 */
const CLEANUP_BATCH_SIZE = 100;

export type CleanupResult = {
    deleted: number;
    rescued: number;
    failed: number;
};

/**
 * Delete staged assets nothing claimed, and rescue the ones something did.
 *
 * A staged asset that a row already points at is a route that forgot to
 * promote — deleting it would break a live page, so it is promoted instead and
 * logged loudly. That check is what makes a forgotten `promoteAssetUrls` a
 * warning in the log rather than a picture that disappears two days later.
 */
export async function runAssetCleanup(ctx: AppContext): Promise<CleanupResult> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - STAGING_EXPIRY_DAYS);

    const assets = await getStagedAssetsForCleanup(
        ctx.db,
        cutoff,
        CLEANUP_BATCH_SIZE,
    );

    if (assets.length === 0) {
        return { deleted: 0, rescued: 0, failed: 0 };
    }

    const referenced = await findAssetReferences(
        ctx.db,
        assets.map((asset) => asset.key),
    );

    let deleted = 0;
    let rescued = 0;
    let failed = 0;

    for (const asset of assets) {
        const referencedBy = referenced.get(asset.key);

        if (referencedBy) {
            await ctx.bucket.promoteAsset(asset.key);
            rescued++;
            console.warn(
                `⚠️  Rescued staged asset ${asset.key}: still referenced by ${referencedBy}. Whatever wrote that row should promote the asset.`,
            );
            continue;
        }

        try {
            await deleteAsset(ctx.bucket, asset.key);
            deleted++;
        } catch (error) {
            failed++;
            console.error(`Failed to delete asset ${asset.key}:`, error);
        }
    }

    console.log(
        `✅ Asset cleanup complete: ${deleted} deleted, ${rescued} rescued, ${failed} failed`,
    );

    return { deleted, rescued, failed };
}

/**
 * Start the asset cleanup cron job
 * Runs every hour at minute 15 to clean up staged assets older than 2 days
 */
export function startAssetCleanupCron(ctx: AppContext): void {
    // Run at minute 15 of every hour
    cron.schedule("15 * * * *", async () => {
        try {
            await runAssetCleanup(ctx);
        } catch (error) {
            console.error("Error in asset cleanup cron:", error);
        }
    });

    console.log("⏰ Asset cleanup cron started (runs hourly at :15)");
}
