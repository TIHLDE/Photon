import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { schema } from "~/db";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";

export const getRoute = route().get(
    "/:id",
    describeRoute({
        tags: ["news"],
        summary: "Get news article",
        operationId: "getNews",
        description: "Get a single news article by ID. Public endpoint.",
        responses: {
            200: {
                description: "News article details",
            },
            404: {
                description: "News article not found",
            },
        },
    }).build(),
    async (c) => {
        const { db } = c.get("ctx");
        const { id } = c.req.param();

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

        return c.json(newsArticle);
    },
);
