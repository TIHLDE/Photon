import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { isNewsCreator } from "~/lib/news/middleware";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import { newsArticleSchema, updateNewsSchema } from "./schema";

export const updateRoute = route().patch(
    "/:id",
    describeRoute({
        tags: ["news"],
        summary: "Update news article",
        operationId: "updateNews",
        description:
            "Update a news article. Requires 'news:update' or 'news:manage' permission (global or scoped) or being the creator.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: newsArticleSchema,
            description: "News article updated successfully",
        })
        .forbidden({ description: "Insufficient permissions" })
        .notFound({ description: "News article not found" })
        .build(),
    requireAuth,
    requireAccess({
        permission: ["news:update", "news:manage"],
        scope: (c) => `news-${c.req.param("id")}`,
        ownership: { param: "id", check: isNewsCreator },
    }),
    validator("json", updateNewsSchema),
    async (c) => {
        const body = c.req.valid("json");
        const { db } = c.get("ctx");
        const { id } = c.req.param();

        // Fetch the news article to verify it exists
        const newsArticle = await db.query.news.findFirst({
            where: eq(schema.news.id, id),
        });

        if (!newsArticle) {
            throw new HTTPException(404, {
                message: "News article not found",
            });
        }

        // Update the news article
        const [updatedNews] = await db
            .update(schema.news)
            .set(body)
            .where(eq(schema.news.id, id))
            .returning();

        return c.json(updatedNews);
    },
);
