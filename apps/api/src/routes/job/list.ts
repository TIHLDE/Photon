import { schema } from "@photon/db";
import { and, desc, eq, gt, gte, ilike, lte, or } from "drizzle-orm";
import { validator } from "hono-openapi";
import type z from "zod";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import {
    getNextPage,
    getPageOffset,
    getTotalPages,
} from "../../middleware/pagination";
import {
    jobListFilterSchema,
    type jobListItemSchema,
    jobListResponseSchema,
} from "./schema";

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
            schema: jobListResponseSchema,
            description: "OK",
        })
        .build(),
    validator("query", jobListFilterSchema),
    async (c) => {
        const { db } = c.get("ctx");
        const { page, pageSize, search, expired, jobType, year } =
            c.req.valid("query");

        const showExpired = expired === true;

        const conditions = and(
            ...[
                // Filter out expired unless explicitly requested.
                //
                // `isContinuouslyHiring` used to be OR-ed in here without any
                // time bound, so every ad marked "fortløpende" stayed on the
                // list forever — including ones posted in 2024. It is now a
                // label only: every ad carries a deadline and falls off when
                // it passes. Ads migrated from Lepton without a deadline are
                // treated as expired.
                !showExpired
                    ? gt(
                          schema.jobPost.deadline,
                          (() => {
                              const d = new Date();
                              d.setDate(d.getDate() - 1);
                              d.setHours(23, 59, 59, 999);
                              return d;
                          })(),
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
            createdById: job.createdById ?? null,
            expired: job.deadline ? job.deadline < now : false,
            createdAt: job.createdAt.toISOString(),
            updatedAt: job.updatedAt.toISOString(),
        })) satisfies z.infer<typeof jobListItemSchema>[];

        return c.json({
            totalCount: jobCount,
            pages: totalPages,
            nextPage: getNextPage(page, totalPages),
            items,
        } satisfies z.infer<typeof jobListResponseSchema>);
    },
);
