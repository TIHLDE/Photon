import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import z from "zod";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";

const jobWithCreatorSchema = z.object({
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
    creator: z
        .object({
            id: z.string(),
            name: z.string(),
            email: z.string(),
        })
        .nullable()
        .meta({ description: "Creator user info" }),
    expired: z
        .boolean()
        .meta({ description: "Whether the job posting has expired" }),
});

export const getRoute = route().get(
    "/:id",
    describeRoute({
        tags: ["jobs"],
        summary: "Get job posting",
        operationId: "getJob",
        description: "Get a single job posting by ID. Public endpoint.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: jobWithCreatorSchema,
            description: "Job posting details",
        })
        .notFound({ description: "Job posting not found" })
        .build(),
    async (c) => {
        const { db } = c.get("ctx");
        const { id } = c.req.param();

        const job = await db.query.jobPost.findFirst({
            where: eq(schema.jobPost.id, id),
            with: {
                creator: {
                    columns: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
        });

        if (!job) {
            throw new HTTPException(404, {
                message: "Job posting not found",
            });
        }

        // Add computed "expired" field
        const now = new Date();
        const jobWithExpired = {
            ...job,
            expired: job.deadline ? job.deadline < now : false,
        };

        return c.json(jobWithExpired);
    },
);
