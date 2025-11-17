import { eq } from "drizzle-orm";
import { describeRoute, resolver, validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import z from "zod";
import { schema } from "~/db";
import { hasAnyPermission } from "~/lib/auth/rbac/permissions";
import { hasPermissionForResource } from "~/lib/auth/rbac/scoped-permissions";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";

const updateJobSchema = z
    .object({
        title: z.string().min(1).max(200).optional(),
        ingress: z.string().max(800).optional(),
        body: z.string().optional(),
        company: z.string().min(1).max(200).optional(),
        location: z.string().min(1).max(200).optional(),
        deadline: z.string().datetime().optional().nullable(),
        isContinuouslyHiring: z.boolean().optional(),
        jobType: z
            .enum(["full_time", "part_time", "summer_job", "other"])
            .optional(),
        email: z.string().email().max(320).optional().nullable(),
        link: z.string().url().optional().nullable(),
        classStart: z
            .enum(["first", "second", "third", "fourth", "fifth", "alumni"])
            .optional(),
        classEnd: z
            .enum(["first", "second", "third", "fourth", "fifth", "alumni"])
            .optional(),
        imageUrl: z.string().url().optional().nullable(),
        imageAlt: z.string().max(255).optional().nullable(),
    })
    .refine(
        (data) => {
            // If both are provided, validate that classStart <= classEnd
            if (data.classStart && data.classEnd) {
                const classOrder = [
                    "first",
                    "second",
                    "third",
                    "fourth",
                    "fifth",
                    "alumni",
                ];
                return (
                    classOrder.indexOf(data.classStart) <=
                    classOrder.indexOf(data.classEnd)
                );
            }
            return true;
        },
        {
            message: "classStart must be less than or equal to classEnd",
            path: ["classStart"],
        },
    );

const updateJobSchemaOpenAPI =
    await resolver(updateJobSchema).toOpenAPISchema();

export const updateRoute = route().patch(
    "/:id",
    describeRoute({
        tags: ["jobs"],
        summary: "Update job posting",
        operationId: "updateJob",
        description:
            "Update a job posting. Requires 'jobs:update' or 'jobs:manage' permission (global or scoped) or being the creator.",
        requestBody: {
            content: {
                "application/json": { schema: updateJobSchemaOpenAPI.schema },
            },
        },
        responses: {
            200: {
                description: "Job posting updated successfully",
            },
            403: {
                description: "Forbidden - Insufficient permissions",
            },
            404: {
                description: "Job posting not found",
            },
        },
    }),
    requireAuth,
    validator("json", updateJobSchema),
    async (c) => {
        const body = c.req.valid("json");
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

        // Check permissions: global (update or manage) OR scoped OR creator
        const hasGlobalPermission = await hasAnyPermission(
            c.get("ctx"),
            userId,
            ["jobs:update", "jobs:manage"],
        );
        const hasScopedUpdatePermission = await hasPermissionForResource(
            c.get("ctx"),
            userId,
            "jobs:update",
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
            !hasScopedUpdatePermission &&
            !hasScopedManagePermission &&
            !isCreator
        ) {
            throw new HTTPException(403, {
                message:
                    "You do not have permission to update this job posting",
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
