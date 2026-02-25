import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import z from "zod";
import { isJobCreator } from "~/lib/job/middleware";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
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
        link: z.url().optional().nullable(),
        classStart: z
            .enum(["first", "second", "third", "fourth", "fifth", "alumni"])
            .optional(),
        classEnd: z
            .enum(["first", "second", "third", "fourth", "fifth", "alumni"])
            .optional(),
        imageUrl: z.url().optional().nullable(),
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

const updateJobResponseSchema = z.object({
    id: z.uuid().meta({ description: "Job posting ID" }),
    title: z.string().meta({ description: "Job title" }),
    ingress: z.string().meta({ description: "Short description" }),
    body: z.string().meta({ description: "Full job description" }),
    company: z.string().meta({ description: "Company name" }),
    location: z.string().meta({ description: "Job location" }),
    deadline: z
        .string()
        .nullable()
        .meta({ description: "Application deadline (ISO 8601)" }),
    isContinuouslyHiring: z
        .boolean()
        .meta({ description: "Is continuously hiring" }),
    jobType: z.enum(schema.jobTypeVariants).meta({ description: "Job type" }),
    email: z.string().nullable().meta({ description: "Contact email" }),
    link: z.string().nullable().meta({ description: "Application link" }),
    classStart: z
        .enum(schema.userClassVariants)
        .meta({ description: "Minimum year of study" }),
    classEnd: z
        .enum(schema.userClassVariants)
        .meta({ description: "Maximum year of study" }),
    imageUrl: z.string().nullable().meta({ description: "Image URL" }),
    imageAlt: z.string().nullable().meta({ description: "Image alt text" }),
    createdById: z.string().nullable().meta({ description: "Creator user ID" }),
    createdAt: z.string().meta({ description: "Creation time (ISO 8601)" }),
    updatedAt: z.string().meta({ description: "Last update time (ISO 8601)" }),
});

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
            schema: updateJobResponseSchema,
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
