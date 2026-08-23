import { schema } from "@photon/db";
import { desc, isNotNull, isNull } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import type z from "zod";
import { canSeeArchivedNews } from "~/lib/news/middleware";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { captureAuth } from "../../middleware/auth";
import {
    getNextPage,
    getPageOffset,
    getTotalPages,
} from "../../middleware/pagination";
import {
    type newsListItemSchema,
    newsListFilterSchema,
    newsListResponseSchema,
} from "./schema";

export const listRoute = route().get(
    "/",
    describeRoute({
        tags: ["news"],
        summary: "List news articles",
        operationId: "listNews",
        description:
            "Get a paginated list of news articles. Public endpoint; archived articles are left out unless the caller asks for them and holds 'news:create', 'news:update' or 'news:manage'.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: newsListResponseSchema,
            description: "OK",
        })
        .forbidden({ description: "Insufficient permissions" })
        .build(),
    captureAuth,
    validator("query", newsListFilterSchema),
    async (c) => {
        const ctx = c.get("ctx");
        const { db } = ctx;
        const { page, pageSize, archived } = c.req.valid("query");

        if (archived !== "exclude") {
            const allowed = await canSeeArchivedNews(ctx, c.get("user")?.id);
            if (!allowed) {
                throw new HTTPException(403, {
                    message:
                        "Forbidden - requires permission: news:create or news:update or news:manage (globally or scoped)",
                });
            }
        }

        // `include` is the only case with no filter at all; the other two each
        // pick one side of `archived_at`.
        const filter =
            archived === "exclude"
                ? isNull(schema.news.archivedAt)
                : archived === "only"
                  ? isNotNull(schema.news.archivedAt)
                  : undefined;

        const newsCount = await db.$count(schema.news, filter);

        const pageOffset = getPageOffset(page, pageSize);
        const totalPages = getTotalPages(newsCount, pageSize);

        const newsList = await db.query.news.findMany({
            where: filter,
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
            archivedAt: n.archivedAt?.toISOString() ?? null,
            createdAt: n.createdAt.toISOString(),
            updatedAt: n.updatedAt.toISOString(),
        })) satisfies z.infer<typeof newsListItemSchema>[];

        return c.json({
            totalCount: newsCount,
            pages: totalPages,
            nextPage: getNextPage(page, totalPages),
            items,
        } satisfies z.infer<typeof newsListResponseSchema>);
    },
);
