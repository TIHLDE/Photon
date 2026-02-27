import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { isJobCreator } from "~/lib/job/middleware";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import { jobDetailSchema, updateJobSchema } from "./schema";

export const updateRoute = route().patch(
    "/:id",
    describeRoute({
        tags: ["jobs"],
        summary: "Update job posting",
        operationId: "updateJob",
        description:
            "Update a job posting. Requires 'jobs:update' or 'jobs:manage' permission (global or scoped) or being the creator.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: jobDetailSchema,
            description: "Job posting updated successfully",
        })
        .forbidden({ description: "Insufficient permissions" })
        .notFound({ description: "Job posting not found" })
        .build(),
    requireAuth,
    requireAccess({
        permission: ["jobs:update", "jobs:manage"],
        scope: (c) => `job-${c.req.param("id")}`,
        ownership: { param: "id", check: isJobCreator },
    }),
    validator("json", updateJobSchema),
    async (c) => {
        const body = c.req.valid("json");
        const { db } = c.get("ctx");
        const { id } = c.req.param();

        // Fetch the job posting for validation
        const job = await db.query.jobPost.findFirst({
            where: eq(schema.jobPost.id, id),
        });

        if (!job) {
            throw new HTTPException(404, {
                message: "Job posting not found",
            });
        }

        // If updating classStart, validate against existing classEnd
        if (body.classStart && !body.classEnd) {
            const classOrder = [
                "first",
                "second",
                "third",
                "fourth",
                "fifth",
                "alumni",
            ];
            if (
                classOrder.indexOf(body.classStart) >
                classOrder.indexOf(job.classEnd)
            ) {
                throw new HTTPException(400, {
                    message:
                        "classStart must be less than or equal to classEnd",
                });
            }
        }

        // If updating classEnd, validate against existing classStart
        if (body.classEnd && !body.classStart) {
            const classOrder = [
                "first",
                "second",
                "third",
                "fourth",
                "fifth",
                "alumni",
            ];
            if (
                classOrder.indexOf(job.classStart) >
                classOrder.indexOf(body.classEnd)
            ) {
                throw new HTTPException(400, {
                    message:
                        "classStart must be less than or equal to classEnd",
                });
            }
        }

        // Update the job posting
        const { deadline, jobType, classStart, classEnd, ...restBody } = body;
        const updateData: Partial<typeof schema.jobPost.$inferInsert> = {
            ...restBody,
        };
        if (deadline !== undefined) {
            updateData.deadline = deadline ? new Date(deadline) : null;
        }
        if (jobType) {
            updateData.jobType = jobType as schema.JobType;
        }
        if (classStart) {
            updateData.classStart = classStart as schema.UserClass;
        }
        if (classEnd) {
            updateData.classEnd = classEnd as schema.UserClass;
        }

        const [updatedJob] = await db
            .update(schema.jobPost)
            .set(updateData)
            .where(eq(schema.jobPost.id, id))
            .returning();

        return c.json(updatedJob);
    },
);
