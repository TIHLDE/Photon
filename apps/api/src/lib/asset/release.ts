import {
    ASSET_QUEUE_NAME,
    type QueueJob,
    type WorkerLike,
} from "@photon/core/services/queue";
import type { AppContext } from "~/lib/ctx";
import { assetKeyFromUrl, deleteAsset } from "./index";
import { IMAGE_VARIANT_WIDTHS, imageVariantKey } from "./image";
import { findAssetReferences } from "./references";

export type AssetReleaseJobData = {
    keys: string[];
};

/**
 * Hand back the assets a deleted row was the last owner of.
 *
 * Uploads are promoted out of "staged" the moment a row points at them, which
 * puts them out of reach of the staged-asset cleanup for good — so nothing
 * removed the picture when the row itself went away. The bucket is capped on
 * object *count*, and a private picture outliving the row that justified it is
 * also a privacy problem: the fine image says who was fined for what.
 *
 * Via the queue rather than a floating promise: background database work that
 * outlives the request keeps querying a torn-down database in the test suite
 * and hangs the run.
 */
export async function enqueueAssetRelease(
    urls: (string | null | undefined)[],
    ctx: AppContext,
): Promise<void> {
    const keys = [
        ...new Set(
            urls
                .map((url) => (url ? ownAssetKey(url) : null))
                .filter((key): key is string => Boolean(key)),
        ),
    ];

    if (keys.length === 0) return;

    try {
        await ctx.queue
            .getQueue<AssetReleaseJobData>(ASSET_QUEUE_NAME)
            .add("release-assets", { keys });
    } catch (error) {
        console.error("Could not enqueue asset release:", error);
    }
}

/**
 * The asset key a stored value names, or null when the value points somewhere
 * we do not own.
 *
 * Columns hold two shapes: our own URL, and the raw key. Anything else is an
 * external address — the Azure blobs the fines carry over from Lepton are the
 * live example — and deleting by it would be a bucket call against a key that
 * was never ours.
 */
function ownAssetKey(value: string): string | null {
    const key = assetKeyFromUrl(value);
    if (key) return key;

    return URL.canParse(value) ? null : value;
}

/**
 * Delete the given keys, minus the ones another row still points at.
 *
 * The reference check is what makes this safe to call from a route that only
 * knows it dropped one row: the same picture can legitimately be shared, and
 * `ASSET_REFERENCE_COLUMNS` covers every column in the database that can hold
 * one. Cached variants carry no `asset` row, so they are removed by key.
 */
export async function releaseAssetKeys(
    keys: string[],
    ctx: AppContext,
): Promise<number> {
    if (keys.length === 0) return 0;

    const referenced = await findAssetReferences(ctx.db, keys);
    let released = 0;

    for (const key of keys) {
        if (referenced.has(key)) continue;

        await deleteAsset(ctx.bucket, key);
        for (const width of IMAGE_VARIANT_WIDTHS) {
            await ctx.bucket.delete(imageVariantKey(key, width));
        }
        released++;
    }

    return released;
}

export function startAssetReleaseWorker(ctx: AppContext): WorkerLike {
    const worker = ctx.queue.createWorker<AssetReleaseJobData, void>(
        ASSET_QUEUE_NAME,
        async (job: QueueJob<AssetReleaseJobData>) => {
            await releaseAssetKeys(job.data.keys, ctx);
        },
    );

    worker.on("failed", (job, err) => {
        console.error(`❌ Asset release job ${job?.id} failed:`, err);
    });

    worker.on("error", (err) => {
        console.error("Asset release worker error:", err);
    });

    return worker;
}
