import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { canSeeArchivedNews } from "~/lib/news/middleware";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { captureAuth } from "../../middleware/auth";
import { newsArticleSchema, newsIdParamSchema } from "./schema";

export const getRoute = route().get(
    "/:id",
    describeRoute({
        tags: ["news"],
        summary: "Get news article",
        operationId: "getNews",
        description:
            "Get a single news article by ID. Public endpoint. An archived article is only visible to callers holding 'news:create', 'news:update' or 'news:manage'.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: newsArticleSchema,
            description: "News article details",
        })
        .notFound({ description: "News article not found" })
        .build(),
    captureAuth,
    async (c) => {
        const ctx = c.get("ctx");
        const { db } = ctx;

        /**
         * Parsed here rather than with `validator("param", ...)` because this
         * route is public and reached by old Lepton links. A caller asking for
         * an article that cannot exist is asking for one that is not here —
         * 404, the same answer a well-formed UUID with no row gets. A 400 would
         * make the website's error boundary treat a dead link as a bug.
         */
        const params = newsIdParamSchema.safeParse(c.req.param());
        if (!params.success) {
            throw new HTTPException(404, {
                message: "News article not found",
            });
        }
        const { id } = params.data;

        const newsArticle = await db.query.news.findFirst({
            where: eq(schema.news.id, id),
            with: {
                creator: {
                    columns: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                reactions: {
                    with: {
                        user: {
                            columns: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                },
            },
        });

        if (!newsArticle) {
            throw new HTTPException(404, {
                message: "News article not found",
            });
        }

        // An archived article was taken off the website on purpose, so to
        // anyone without the news permissions it is simply not there — the
        // same answer a deleted one gives, and one that leaks nothing.
        if (
            newsArticle.archivedAt &&
            !(await canSeeArchivedNews(ctx, c.get("user")?.id))
        ) {
            throw new HTTPException(404, {
                message: "News article not found",
            });
        }

        return c.json(newsArticle);
    },
);
