import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { schema } from "~/db";
import { hasScopedPermission } from "~/lib/auth/rbac/roles";
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
        .response({
            statusCode: 200,
            description: "Job posting deleted successfully",
        })
        .forbidden({ description: "Insufficient permissions" })
        .notFound({ description: "Job posting not found" })
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

        // Check permissions: global or scoped (delete or manage) OR creator
        const scope = `job-${id}`;
        const [hasDeletePermission, hasManagePermission] = await Promise.all([
            hasScopedPermission(c.get("ctx"), userId, "jobs:delete", scope),
            hasScopedPermission(c.get("ctx"), userId, "jobs:manage", scope),
        ]);
        const isCreator = job.createdById === userId;

        if (!hasDeletePermission && !hasManagePermission && !isCreator) {
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
