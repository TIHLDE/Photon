import { eq } from "drizzle-orm";
import { describeRoute } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { schema } from "~/db";
import { route } from "~/lib/route";

export const getRoute = route().get(
    "/:id",
    describeRoute({
        tags: ["jobs"],
        summary: "Get job posting",
        operationId: "getJob",
        description: "Get a single job posting by ID. Public endpoint.",
        responses: {
            200: {
                description: "Job posting details",
            },
            404: {
                description: "Job posting not found",
            },
        },
    }),
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
