import { ASSET_QUEUE_NAME } from "@photon/core/services/queue";
import {
    type AssetReleaseJobData,
    releaseAssetKeys,
} from "~/lib/asset/release";
import type { TestUtilContext } from "./index";

/**
 * Run the asset-release jobs a route queued.
 *
 * The test queue is in "manual" mode and no workers are started, so a route
 * that hands its cleanup to the queue has done nothing observable until this
 * runs. Returns the jobs, so a test can assert on what was queued as well as
 * on what the release did.
 */
export const createRunAssetReleases =
    (ctx: TestUtilContext) => async (): Promise<AssetReleaseJobData[]> => {
        const jobs = await ctx.queue
            .getQueue<AssetReleaseJobData>(ASSET_QUEUE_NAME)
            .getJobs();

        for (const job of jobs) {
            await releaseAssetKeys(job.data.keys, ctx);
        }

        return jobs.map((job) => job.data);
    };
