import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import z from "zod";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";

const deleteReactionResponseSchema = z.object({
    message: z.string(),
});

export const deleteReactionRoute = route().delete(
    "/:id/reactions",
    describeRoute({
        tags: ["news"],
        summary: "Remove reaction from news",
        operationId: "deleteNewsReaction",
        description: "Remove your emoji reaction from a news article.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: deleteReactionResponseSchema,
            description: "Reaction removed successfully",
        })
        .notFound({ description: "News article or reaction not found" })
        .build(),
    requireAuth,
    async (c) => {
        const userId = c.get("user").id;
        const { db } = c.get("ctx");
        const { id: newsId } = c.req.param();

        // Check if news exists
        const newsArticle = await db.query.news.findFirst({
            where: eq(schema.news.id, newsId),
        });

        if (!newsArticle) {
            throw new HTTPException(404, {
                message: "News article not found",
            });
        }

        // Check if reaction exists
        const reaction = await db.query.newsReaction.findFirst({
            where: and(
                eq(schema.newsReaction.userId, userId),
                eq(schema.newsReaction.newsId, newsId),
            ),
        });

        if (!reaction) {
            throw new HTTPException(404, {
                message: "Reaction not found",
            });
        }

        // Delete the reaction
        await db
            .delete(schema.newsReaction)
            .where(
                and(
                    eq(schema.newsReaction.userId, userId),
                    eq(schema.newsReaction.newsId, newsId),
                ),
            );

        return c.json({ message: "Reaction removed successfully" });
    },
);
