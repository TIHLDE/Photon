import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import z from "zod";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";

const newsArticleSchema = z.object({
    id: z.uuid().meta({ description: "News article ID" }),
    title: z.string().meta({ description: "News article title" }),
    header: z.string().meta({ description: "News article subtitle/ingress" }),
    body: z.string().meta({ description: "Main content" }),
    imageUrl: z.string().nullable().meta({ description: "Image URL" }),
    imageAlt: z.string().nullable().meta({ description: "Image alt text" }),
    emojisAllowed: z
        .boolean()
        .meta({ description: "Whether reactions are enabled" }),
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
    reactions: z.array(
        z.object({
            userId: z.string(),
            newsId: z.uuid(),
            emoji: z.string(),
            createdAt: z.string(),
            user: z.object({
                id: z.string(),
                name: z.string(),
            }),
        }),
    ),
});

export const getRoute = route().get(
    "/:id",
    describeRoute({
        tags: ["news"],
        summary: "Get news article",
        operationId: "getNews",
        description: "Get a single news article by ID. Public endpoint.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: newsArticleSchema,
            description: "News article details",
        })
        .notFound({ description: "News article not found" })
        .build(),
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
