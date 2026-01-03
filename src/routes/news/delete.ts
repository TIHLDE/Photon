import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { schema } from "~/db";
import { hasAnyPermission } from "~/lib/auth/rbac/permissions";
import { hasPermissionForResource } from "~/lib/auth/rbac/scoped-permissions";
import { describeAuthenticatedRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";

export const deleteRoute = route().delete(
    "/:id",
    describeAuthenticatedRoute({
        tags: ["news"],
        summary: "Delete news article",
        operationId: "deleteNews",
        description:
            "Delete a news article. Requires 'news:delete' or 'news:manage' permission (global or scoped) or being the creator.",
        responses: {
            200: {
                description: "News article deleted successfully",
            },
            403: {
                description: "Forbidden - Insufficient permissions",
            },
            404: {
                description: "News article not found",
            },
        },
    }).build(),
    requireAuth,
    async (c) => {
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

        // Check permissions: global (delete or manage) OR scoped OR creator
        const hasGlobalPermission = await hasAnyPermission(
            c.get("ctx"),
            userId,
            ["news:delete", "news:manage"],
        );
        const hasScopedDeletePermission = await hasPermissionForResource(
            c.get("ctx"),
            userId,
            "news:delete",
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
            !hasScopedDeletePermission &&
            !hasScopedManagePermission &&
            !isCreator
        ) {
            throw new HTTPException(403, {
                message:
                    "You do not have permission to delete this news article",
            });
        }

        // Delete the news article
        await db.delete(schema.news).where(eq(schema.news.id, id));

        return c.json({ message: "News article deleted successfully" });
    },
);
