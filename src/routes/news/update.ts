import { eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import z from "zod";
import { schema } from "~/db";
import { hasAnyPermission } from "~/lib/auth/rbac/permissions";
import { hasPermissionForResource } from "~/lib/auth/rbac/scoped-permissions";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";

const updateNewsSchema = z.object({
    title: z.string().min(1).max(200).optional(),
    header: z.string().min(1).max(200).optional(),
    body: z.string().min(1).optional(),
    imageUrl: z.string().url().optional().nullable(),
    imageAlt: z.string().max(255).optional().nullable(),
    emojisAllowed: z.boolean().optional(),
});

export const updateRoute = route().patch(
    "/:id",
    describeRoute({
        tags: ["news"],
        summary: "Update news article",
        operationId: "updateNews",
        description:
            "Update a news article. Requires 'news:update' or 'news:manage' permission (global or scoped) or being the creator.",
    })
        .response({
            statusCode: 200,
            description: "News article updated successfully",
        })
        .forbidden({ description: "Insufficient permissions" })
        .notFound({ description: "News article not found" })
        .build(),
    requireAuth,
    validator("json", updateNewsSchema),
    async (c) => {
        const body = c.req.valid("json");
        const userId = c.get("user").id;
        const { db } = c.get("ctx");
        const { id } = c.req.param();

        // Fetch the news article
        const newsArticle = await db.query.news.findFirst({
            where: eq(schema.news.id, id),
        });

        if (!newsArticle) {
            throw new HTTPException(404, {
                message: "News article not found",
            });
        }

        // Check permissions: global (update or manage) OR scoped OR creator
        const hasGlobalPermission = await hasAnyPermission(
            c.get("ctx"),
            userId,
            ["news:update", "news:manage"],
        );
        const hasScopedUpdatePermission = await hasPermissionForResource(
            c.get("ctx"),
            userId,
            "news:update",
            `news-${id}`,
        );
        const hasScopedManagePermission = await hasPermissionForResource(
            c.get("ctx"),
            userId,
            "news:manage",
            `news-${id}`,
        );
        const isCreator = newsArticle.createdById === userId;

        if (
            !hasGlobalPermission &&
            !hasScopedUpdatePermission &&
            !hasScopedManagePermission &&
            !isCreator
        ) {
            throw new HTTPException(403, {
                message:
                    "You do not have permission to update this news article",
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
