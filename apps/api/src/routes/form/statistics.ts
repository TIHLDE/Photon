import { hasPermission } from "@photon/auth/rbac";
import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { calculateFormStatistics, canManageForm } from "~/lib/form/service";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { formStatisticsSchema } from "./schema";

export const statisticsRoute = route().get(
    "/:id/statistics",
    describeRoute({
        tags: ["forms"],
        summary: "Get form statistics",
        operationId: "getFormStatistics",
        description:
            "Get aggregated statistics for a form. Requires permission to manage the form.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: formStatisticsSchema,
            description: "Success",
        })
        .forbidden()
        .notFound()
        .build(),
    requireAuth,
    async (c) => {
        const { db, ...ctx } = c.get("ctx");
        const user = c.get("user");
        const formId = c.req.param("id");

        if (!user) {
            throw new HTTPException(401, {
                message: "Authentication required",
            });
        }

        // Check if form exists
        const form = await db.query.form.findFirst({
            where: eq(schema.form.id, formId),
        });

        if (!form) {
            throw new HTTPException(404, {
                message: "Form not found",
            });
        }

        // Check permissions
        const hasAdminPermission = await hasPermission(
            { db, ...ctx },
            user.id,
            "forms:manage",
        );
        const canManage = await canManageForm(
            db,
            formId,
            user.id,
            hasAdminPermission,
        );

        if (!canManage) {
            throw new HTTPException(403, {
                message:
                    "You do not have permission to view statistics for this form",
            });
        }

        // Calculate statistics
        const stats = await calculateFormStatistics(db, formId);

        return c.json({
            id: stats.id,
            title: stats.title,
            resource_type: "Form",
            statistics: stats.statistics,
        });
    },
);
