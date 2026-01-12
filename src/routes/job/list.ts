import { and, desc, gt, ilike, or } from "drizzle-orm";
import { schema } from "~/db";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";

export const listRoute = route().get(
    "/",
    describeRoute({
        tags: ["jobs"],
        summary: "List job postings",
        operationId: "listJobs",
        description:
            "Get a list of job postings. Supports search and expired filtering. Public endpoint.",
    })
        .response({ statusCode: 200, description: "List of job postings" })
        .build(),
    async (c) => {
        const { db } = c.get("ctx");
        const { search, expired } = c.req.query();

        const showExpired = expired === "true";

        // Build query conditions
        const conditions = [];

        // Filter expired jobs (unless explicitly requested)
        if (!showExpired) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            yesterday.setHours(23, 59, 59, 999);

            conditions.push(
                or(
                    gt(schema.jobPost.deadline, yesterday),
                    schema.jobPost.isContinuouslyHiring,
                ),
            );
        }

        // Search by title or company
        if (search) {
            conditions.push(
                or(
                    ilike(schema.jobPost.title, `%${search}%`),
                    ilike(schema.jobPost.company, `%${search}%`),
                ),
            );
        }

        const jobs = await db.query.jobPost.findMany({
            where: conditions.length > 0 ? and(...conditions) : undefined,
            orderBy: [desc(schema.jobPost.createdAt)],
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

        // Add computed "expired" field
        const now = new Date();
        const jobsWithExpired = jobs.map((job) => ({
            ...job,
            expired: job.deadline ? job.deadline < now : false,
        }));

        return c.json(jobsWithExpired);
    },
);
