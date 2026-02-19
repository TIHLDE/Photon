import { schema } from "@photon/db";
import { desc } from "drizzle-orm";
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

const newsSchema = z.object({
    id: z.uuid({ version: "v4" }).meta({ description: "News ID" }),
    title: z.string().meta({ description: "News title" }),
    header: z.string().meta({ description: "News header" }),
    body: z.string().meta({ description: "News body" }),
    imageUrl: z.string().nullable().meta({ description: "Image URL" }),
    imageAlt: z.string().nullable().meta({ description: "Image alt text" }),
    emojisAllowed: z
        .boolean()
        .meta({ description: "Whether reactions are allowed" }),
    createdAt: z.iso.date().meta({ description: "Creation time (ISO 8601)" }),
    updatedAt: z.iso
        .date()
        .meta({ description: "Last update time (ISO 8601)" }),
});

const ResponseSchema = PagniationResponseSchema.extend({
    items: z.array(newsSchema).describe("List of news articles"),
});

export const listRoute = route().get(
    "/",
    describeRoute({
        tags: ["news"],
        summary: "List news articles",
        operationId: "listNews",
        description:
            "Get a paginated list of all news articles. Public endpoint.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: ResponseSchema,
            description: "OK",
        })
        .build(),
    validator("query", PaginationSchema),
    async (c) => {
        const { db } = c.get("ctx");
        const { page, pageSize } = c.req.valid("query");

        const newsCount = await db.$count(schema.news);

        const pageOffset = getPageOffset(page, pageSize);
        const totalPages = getTotalPages(newsCount, pageSize);

        const newsList = await db.query.news.findMany({
            orderBy: [desc(schema.news.createdAt)],
            limit: pageSize,
            offset: pageOffset,
        });

        const items = newsList.map((n) => ({
            id: n.id,
            title: n.title,
            header: n.header,
            body: n.body,
            imageUrl: n.imageUrl ?? null,
            imageAlt: n.imageAlt ?? null,
            emojisAllowed: n.emojisAllowed,
            createdAt: n.createdAt.toISOString(),
            updatedAt: n.updatedAt.toISOString(),
        })) satisfies z.infer<typeof newsSchema>[];

        return c.json({
            totalCount: newsCount,
            pages: totalPages,
            nextPage: page + 1 >= totalPages ? null : page + 1,
            items,
        } satisfies z.infer<typeof ResponseSchema>);
    },
);
