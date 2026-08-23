import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { isNewsCreator } from "~/lib/news/middleware";
import { promoteAssetUrls } from "~/lib/asset";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import {
    newsArticleSchema,
    newsIdParamSchema,
    updateNewsSchema,
} from "./schema";

export const updateRoute = route().patch(
    "/:id",
    describeRoute({
        tags: ["news"],
        summary: "Update news article",
        operationId: "updateNews",
        description:
            "Update a news article, including archiving and restoring it via `archived`. Requires 'news:update' or 'news:manage', held globally or for any single group, or being the creator.",
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
    // Before `requireAccess`: its ownership check looks the article up by this
    // id, so an unparseable one would reach the database there rather than here.
    validator("param", newsIdParamSchema),
    requireAccess({
        permission: ["news:update", "news:manage"],
        scope: (c) => `news-${c.req.param("id")}`,
        anyGroupScope: true,
        ownership: { param: "id", check: isNewsCreator },
    }),
    validator("json", updateNewsSchema),
    async (c) => {
        const { archived, ...body } = c.req.valid("json");
        const { db, bucket } = c.get("ctx");
        const { id } = c.req.valid("param");

        // Fetch the news article to verify it exists
        const newsArticle = await db.query.news.findFirst({
            where: eq(schema.news.id, id),
        });

        if (!newsArticle) {
            throw new HTTPException(404, {
                message: "News article not found",
            });
        }

        // Uploaded pictures are staged until a row claims them; without
        // this the cleanup cron deletes the file after two days.
        await promoteAssetUrls(bucket, [body.imageUrl]);

        // Update the news article
        const [updatedNews] = await db
            .update(schema.news)
            .set({
                ...body,
                // Archiving is a timestamp on the row, not a field the client
                // sets: `archived` says which way to move it, and leaving the
                // flag out leaves the current state alone. Archiving one that
                // is already archived keeps the original date — nothing moved,
                // so "off the website since" must not quietly become today.
                ...(archived === undefined
                    ? {}
                    : {
                          archivedAt: archived
                              ? (newsArticle.archivedAt ?? new Date())
                              : null,
                      }),
            })
            .where(eq(schema.news.id, id))
            .returning();

        return c.json(updatedNews);
    },
);
