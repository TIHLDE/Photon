import { hasPermission } from "@photon/auth/rbac";
import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import type { AppContext } from "~/lib/ctx";

/**
 * Check if a user is the creator of a news article.
 */
export const isNewsCreator = async (
    ctx: AppContext,
    newsId: string,
    userId: string,
): Promise<boolean> => {
    const article = await ctx.db
        .select({ createdById: schema.news.createdById })
        .from(schema.news)
        .where(eq(schema.news.id, newsId))
        .limit(1)
        .then((res) => res[0]);

    return article?.createdById === userId;
};

/**
 * Permissions that let a caller see archived articles.
 *
 * Same set that opens the news section of the admin panel: archiving takes an
 * article off the website without deleting it, so whoever runs the news pages
 * is exactly who still needs to reach it.
 */
export const NEWS_ARCHIVE_PERMISSIONS = [
    "news:create",
    "news:update",
    "news:manage",
];

/** Whether this caller may see archived articles. */
export const canSeeArchivedNews = async (
    ctx: AppContext,
    userId: string | undefined,
): Promise<boolean> => {
    if (!userId) return false;
    return hasPermission(ctx, userId, NEWS_ARCHIVE_PERMISSIONS);
};
