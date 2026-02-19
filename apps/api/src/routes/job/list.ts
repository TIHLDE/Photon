import { schema } from "@photon/db";
import { and, desc, eq, gt, gte, ilike, lte, or } from "drizzle-orm";
import { validator } from "hono-openapi";
import z from "zod";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import {
    PaginationSchema,
    PagniationResponseSchema,
    getPageOffset,
    getTotalPages,
} from "../../middleware/pagination";

const jobPostSchema = z.object({
    id: z.uuid({ version: "v4" }).meta({ description: "Job post ID" }),
    title: z.string().meta({ description: "Job title" }),
    ingress: z.string().meta({ description: "Short description" }),
    body: z.string().meta({ description: "Full job description" }),
    company: z.string().meta({ description: "Company name" }),
    location: z.string().meta({ description: "Job location" }),

    deadline: z.iso
        .date()
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

    expired: z
        .boolean()
        .meta({ description: "Whether the job posting has expired" }),
    createdAt: z.iso.date().meta({ description: "Creation time (ISO 8601)" }),
    updatedAt: z.iso
        .date()
        .meta({ description: "Last update time (ISO 8601)" }),
});

const filterSchema = PaginationSchema.extend({
    search: z.string().optional().meta({
        description: "Search term to filter by title or company name",
    }),
    expired: z.coerce.boolean().optional().meta({
        description: "Include expired job postings (default: false)",
    }),
    jobType: z.enum(schema.jobTypeVariants).optional().meta({
        description: "Filter by job type",
    }),
    year: z.enum(schema.userClassVariants).optional().meta({
        description:
            "Filter by year of study (returns jobs targeting that class)",
    }),
});

const ResponseSchema = PagniationResponseSchema.extend({
    items: z.array(jobPostSchema).describe("List of job postings"),
});

export const listRoute = route().get(
    "/",
    describeRoute({
        tags: ["jobs"],
        summary: "List job postings",
        operationId: "listJobs",
        description:
            "Get a paginated list of job postings. Supports search, job type, year of study, and expired filtering. Public endpoint.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: ResponseSchema,
            description: "OK",
        })
        .build(),
    validator("query", filterSchema),
    async (c) => {
        const { db } = c.get("ctx");
        const { page, pageSize, search, expired, jobType, year } =
            c.req.valid("query");

        const showExpired = expired === true;

        const conditions = and(
            ...[
                // Filter out expired unless explicitly requested
                !showExpired
                    ? or(
                          gt(
                              schema.jobPost.deadline,
                              (() => {
                                  const d = new Date();
                                  d.setDate(d.getDate() - 1);
                                  d.setHours(23, 59, 59, 999);
                                  return d;
                              })(),
                          ),
                          schema.jobPost.isContinuouslyHiring,
                      )
                    : undefined,
                // Free text search on title and company
                search
                    ? or(
                          ilike(schema.jobPost.title, `%${search}%`),
                          ilike(schema.jobPost.company, `%${search}%`),
                      )
                    : undefined,
                // Filter by job type
                jobType ? eq(schema.jobPost.jobType, jobType) : undefined,
                // Filter by year of study: job must target a range that includes the requested class
                year
                    ? and(
                          lte(schema.jobPost.classStart, year),
                          gte(schema.jobPost.classEnd, year),
                      )
                    : undefined,
            ].filter(Boolean),
        );

        const jobCount = await db.$count(schema.jobPost, conditions);

        const pageOffset = getPageOffset(page, pageSize);
        const totalPages = getTotalPages(jobCount, pageSize);

        const jobs = await db.query.jobPost.findMany({
            where: conditions,
            orderBy: [desc(schema.jobPost.createdAt)],
            limit: pageSize,
            offset: pageOffset,
        });

        const now = new Date();
        const items = jobs.map((job) => ({
            id: job.id,
            title: job.title,
            ingress: job.ingress,
            body: job.body,
            company: job.company,
            location: job.location,
            deadline: job.deadline?.toISOString() ?? null,
            isContinuouslyHiring: job.isContinuouslyHiring,
            jobType: job.jobType,
            email: job.email ?? null,
            link: job.link ?? null,
            classStart: job.classStart,
            classEnd: job.classEnd,
            imageUrl: job.imageUrl ?? null,
            imageAlt: job.imageAlt ?? null,
            expired: job.deadline ? job.deadline < now : false,
            createdAt: job.createdAt.toISOString(),
            updatedAt: job.updatedAt.toISOString(),
        })) satisfies z.infer<typeof jobPostSchema>[];

        return c.json({
            totalCount: jobCount,
            pages: totalPages,
            nextPage: page + 1 >= totalPages ? null : page + 1,
            items,
        } satisfies z.infer<typeof ResponseSchema>);
    },
);
