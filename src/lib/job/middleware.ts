import { eq } from "drizzle-orm";
import { schema } from "~/db";
import type { AppContext } from "~/lib/ctx";

/**
 * Check if a user is the creator of a job posting.
 */
export const isJobCreator = async (
    ctx: AppContext,
    jobId: string,
    userId: string,
): Promise<boolean> => {
    const job = await ctx.db
        .select({ createdById: schema.jobPost.createdById })
        .from(schema.jobPost)
        .where(eq(schema.jobPost.id, jobId))
        .limit(1)
        .then((res) => res[0]);

    return job?.createdById === userId;
};
