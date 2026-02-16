import type { OwnershipChecker } from "@photon/auth/server";
import { schema } from "@photon/db";
import { eq } from "drizzle-orm";

/**
 * Check if a user is the creator of a news article.
 */
export const isNewsCreator: OwnershipChecker = async (ctx, newsId, userId) => {
    const article = await ctx.db
        .select({ createdById: schema.news.createdById })
        .from(schema.news)
        .where(eq(schema.news.id, newsId))
        .limit(1)
        .then((res) => res[0]);

    return article?.createdById === userId;
};
