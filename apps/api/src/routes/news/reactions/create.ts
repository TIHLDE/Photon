import { requireAuth } from "@photon/auth/server";
import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import z from "zod";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";

const createReactionSchema = z.object({
    emoji: z
        .string()
        .min(1)
        .max(32)
        .meta({ description: "Emoji reaction (e.g., 👍, ❤️, 😂)" }),
});

export const createReactionRoute = route().post(
    "/:id/reactions",
    describeRoute({
        tags: ["news"],
        summary: "Add reaction to news",
        operationId: "createNewsReaction",
        description:
            "Add or update emoji reaction to a news article. Requires authentication.",
    })
        .response({
            statusCode: 201,
            description: "Reaction added successfully",
        })
        .forbidden({
            description: "Reactions not allowed on this news article",
        })
        .notFound({ description: "News article not found" })
        .build(),
    requireAuth,
    validator("json", createReactionSchema),
    async (c) => {
        const body = c.req.valid("json");
        const userId = c.get("user").id;
        const { db } = c.get("ctx");
        const { id: newsId } = c.req.param();

        // Check if news exists and reactions are allowed
        const newsArticle = await db.query.news.findFirst({
            where: eq(schema.news.id, newsId),
        });

        if (!newsArticle) {
            throw new HTTPException(404, {
                message: "News article not found",
            });
        }

        if (!newsArticle.emojisAllowed) {
            throw new HTTPException(403, {
                message: "Reactions are not allowed on this news article",
            });
        }

        // Check if user already has a reaction
        const existingReaction = await db.query.newsReaction.findFirst({
            where: and(
                eq(schema.newsReaction.userId, userId),
                eq(schema.newsReaction.newsId, newsId),
            ),
        });

        if (existingReaction) {
            // Update existing reaction
            const [updatedReaction] = await db
                .update(schema.newsReaction)
                .set({ emoji: body.emoji })
                .where(
                    and(
                        eq(schema.newsReaction.userId, userId),
                        eq(schema.newsReaction.newsId, newsId),
                    ),
                )
                .returning();

            return c.json(updatedReaction);
        }

        // Create new reaction
        const [newReaction] = await db
            .insert(schema.newsReaction)
            .values({
                userId,
                newsId,
                emoji: body.emoji,
            })
            .returning();

        return c.json(newReaction, 201);
    },
);
