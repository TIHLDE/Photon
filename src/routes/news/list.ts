import { desc } from "drizzle-orm";
import { schema } from "~/db";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";

export const listRoute = route().get(
    "/",
    describeRoute({
        tags: ["news"],
        summary: "List news articles",
        operationId: "listNews",
        description:
            "Get a paginated list of all news articles. Public endpoint.",
        responses: {
            200: {
                description: "List of news articles",
            },
        },
    }).build(),
    async (c) => {
        const { db } = c.get("ctx");

        const newsList = await db.query.news.findMany({
            orderBy: [desc(schema.news.createdAt)],
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

        return c.json(newsList);
    },
);
