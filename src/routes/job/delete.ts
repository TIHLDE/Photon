import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { schema } from "~/db";
import { hasAnyPermission } from "~/lib/auth/rbac/permissions";
import { hasPermissionForResource } from "~/lib/auth/rbac/scoped-permissions";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";

export const deleteRoute = route().delete(
    "/:id",
    describeRoute({
        tags: ["jobs"],
        summary: "Delete job posting",
        operationId: "deleteJob",
        description:
            "Delete a job posting. Requires 'jobs:delete' or 'jobs:manage' permission (global or scoped) or being the creator.",
    })
        .response(200, "Job posting deleted successfully")
        .forbidden("Insufficient permissions")
        .notFound("Job posting not found")
        .build(),
    requireAuth,
    async (c) => {
        const userId = c.get("user").id;
        const { db } = c.get("ctx");
        const { id } = c.req.param();

        // Fetch the job posting
        const job = await db.query.jobPost.findFirst({
            where: eq(schema.jobPost.id, id),
        });

        if (!job) {
            throw new HTTPException(404, {
                message: "Job posting not found",
            });
        }

        // Check permissions: global (delete or manage) OR scoped OR creator
        const hasGlobalPermission = await hasAnyPermission(
            c.get("ctx"),
            userId,
            ["jobs:delete", "jobs:manage"],
        );
        const hasScopedDeletePermission = await hasPermissionForResource(
            c.get("ctx"),
            userId,
            "jobs:delete",
            `job-${id}`,
        );
        const hasScopedManagePermission = await hasPermissionForResource(
            c.get("ctx"),
            userId,
            "jobs:manage",
            `job-${id}`,
        );
        const isCreator = job.createdById === userId;

        if (
            !hasGlobalPermission &&
            !hasScopedDeletePermission &&
            !hasScopedManagePermission &&
            !isCreator
        ) {
            throw new HTTPException(403, {
                message:
                    "You do not have permission to delete this job posting",
            });
        }

        // Delete the job posting
        await db.delete(schema.jobPost).where(eq(schema.jobPost.id, id));

        return c.json({ message: "Job posting deleted successfully" });
    },
);
