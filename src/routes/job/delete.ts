import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { schema } from "~/db";
import { isJobCreator } from "~/lib/job/middleware";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
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
    requireAccess({
        permission: ["jobs:delete", "jobs:manage"],
        scope: (c) => `job-${c.req.param("id")}`,
        ownership: { param: "id", check: isJobCreator },
    }),
    async (c) => {
        const { db } = c.get("ctx");
        const { id } = c.req.param();

        // Check if job exists
        const job = await db.query.jobPost.findFirst({
            where: eq(schema.jobPost.id, id),
        });

        if (!job) {
            throw new HTTPException(404, {
                message: "Job posting not found",
            });
        }

        // Delete the job posting
        await db.delete(schema.jobPost).where(eq(schema.jobPost.id, id));

        return c.json({ message: "Job posting deleted successfully" });
    },
);
