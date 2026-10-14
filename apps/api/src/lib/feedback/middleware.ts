import { hasPermission } from "@photon/auth/rbac";
import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import type { AppContext } from "~/lib/ctx";

/**
 * Check if a user wrote a piece of feedback.
 *
 * Feedback with no author (the member has since been deleted) is owned by
 * nobody — the `?? false` keeps a null author from matching a null user id.
 */
export const isFeedbackAuthor = async (
    ctx: AppContext,
    feedbackId: string,
    userId: string,
): Promise<boolean> => {
    const item = await ctx.db
        .select({ authorId: schema.feedback.authorId })
        .from(schema.feedback)
        .where(eq(schema.feedback.id, feedbackId))
        .limit(1)
        .then((res) => res[0]);

    return item?.authorId != null && item.authorId === userId;
};

/**
 * Moderators — Index — may change a feedback's status, and see who filed it
 * even when it is anonymous. Anonymity hides the author from other members,
 * not from the people handling the report.
 */
export const canModerateFeedback = (
    ctx: AppContext,
    userId: string,
): Promise<boolean> =>
    hasPermission(ctx, userId, ["feedback:update", "feedback:manage"]);
