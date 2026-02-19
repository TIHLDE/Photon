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
