import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { isNewsCreator } from "~/lib/news/middleware";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import { deleteNewsResponseSchema } from "./schema";

export const deleteRoute = route().delete(
    "/:id",
    describeRoute({
        tags: ["news"],
        summary: "Delete news article",
        operationId: "deleteNews",
        description:
            "Delete a news article. Requires 'news:delete' or 'news:manage' permission (global or scoped) or being the creator.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: deleteNewsResponseSchema,
            description: "News article deleted successfully",
        })
        .forbidden({ description: "Insufficient permissions" })
        .notFound({ description: "News article not found" })
        .build(),
    requireAuth,
    requireAccess({
        permission: ["news:delete", "news:manage"],
        scope: (c) => `news-${c.req.param("id")}`,
        ownership: { param: "id", check: isNewsCreator },
    }),
    async (c) => {
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

        // Delete the news article
        await db.delete(schema.news).where(eq(schema.news.id, id));

        return c.json({ message: "News article deleted successfully" });
    },
);
