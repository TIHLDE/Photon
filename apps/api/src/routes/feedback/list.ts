import { schema } from "@photon/db";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { validator } from "hono-openapi";
import type z from "zod";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import {
    PaginationSchema,
    getNextPage,
    getPageOffset,
    getTotalPages,
} from "~/middleware/pagination";
import {
    type feedbackItemSchema,
    feedbackListResponseSchema,
    listFeedbackQuerySchema,
} from "./schema";

export const listRoute = route().get(
    "/",
    describeRoute({
        tags: ["feedback"],
        summary: "List feedback",
        operationId: "listFeedback",
        description:
            "Paginated list of ideas and bug reports, newest first. Requires authentication.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: feedbackListResponseSchema,
            description: "OK",
        })
        .build(),
    requireAuth,
    validator("query", PaginationSchema.extend(listFeedbackQuerySchema.shape)),
    async (c) => {
        const { db } = c.get("ctx");
        const userId = c.get("user").id;
        const { page, pageSize, type, status, search } = c.req.valid("query");

        const filters = [
            type ? eq(schema.feedback.type, type) : undefined,
            status ? eq(schema.feedback.status, status) : undefined,
            search
                ? or(
                      ilike(schema.feedback.title, `%${search}%`),
                      ilike(schema.feedback.description, `%${search}%`),
                  )
                : undefined,
        ].filter((f) => f !== undefined);

        const where = filters.length > 0 ? and(...filters) : undefined;

        const totalCount = await db.$count(schema.feedback, where);
        const totalPages = getTotalPages(totalCount, pageSize);

        /**
         * The author is selected only to answer "did I file this?" — feedback
         * is shown anonymously, so no name or picture leaves the database.
         *
         * Vote counts are aggregated in the query rather than by loading every
         * vote row: the page shows a running tally per item and nothing else,
         * and a popular idea can collect hundreds of votes that would then be
         * serialized only to be counted and thrown away.
         */
        const rows = await db
            .select({
                id: schema.feedback.id,
                type: schema.feedback.type,
                status: schema.feedback.status,
                title: schema.feedback.title,
                description: schema.feedback.description,
                createdAt: schema.feedback.createdAt,
                updatedAt: schema.feedback.updatedAt,
                authorId: schema.feedback.authorId,
                upvotes:
                    sql<number>`count(*) filter (where ${schema.feedbackVote.value} = 'up')`.mapWith(
                        Number,
                    ),
                downvotes:
                    sql<number>`count(*) filter (where ${schema.feedbackVote.value} = 'down')`.mapWith(
                        Number,
                    ),
                myVote: sql<
                    "up" | "down" | null
                >`max(${schema.feedbackVote.value}::text) filter (where ${schema.feedbackVote.userId} = ${userId})`,
            })
            .from(schema.feedback)
            .leftJoin(
                schema.feedbackVote,
                eq(schema.feedbackVote.feedbackId, schema.feedback.id),
            )
            .where(where)
            .groupBy(schema.feedback.id)
            .orderBy(desc(schema.feedback.createdAt))
            .limit(pageSize)
            .offset(getPageOffset(page, pageSize));

        const items = rows.map((row) => ({
            id: row.id,
            type: row.type,
            status: row.status,
            title: row.title,
            description: row.description,
            isAuthor: row.authorId === userId,
            upvotes: row.upvotes,
            downvotes: row.downvotes,
            myVote: row.myVote,
            createdAt: row.createdAt.toISOString(),
            updatedAt: row.updatedAt.toISOString(),
        })) satisfies z.infer<typeof feedbackItemSchema>[];

        return c.json({
            totalCount,
            pages: totalPages,
            nextPage: getNextPage(page, totalPages),
            items,
        } satisfies z.infer<typeof feedbackListResponseSchema>);
    },
);
