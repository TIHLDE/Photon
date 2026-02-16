import type { OwnershipChecker } from "@photon/auth/server";
import { schema } from "@photon/db";
import { eq } from "drizzle-orm";

/**
 * Check if a user is the creator of a job posting.
 */
export const isJobCreator: OwnershipChecker = async (ctx, jobId, userId) => {
    const job = await ctx.db
        .select({ createdById: schema.jobPost.createdById })
        .from(schema.jobPost)
        .where(eq(schema.jobPost.id, jobId))
        .limit(1)
        .then((res) => res[0]);

    return job?.createdById === userId;
};
