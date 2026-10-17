import { schema } from "@photon/db";
import { and, asc, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { validator } from "hono-openapi";
import type z from "zod";
import {
    selectFeedbackItems,
    serializeFeedbackItem,
} from "~/lib/feedback/serialize";
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

const RESOLVED_FEEDBACK_STATUSES = ["closed", "rejected"] as const;

export const listRoute = route().get(
    "/",
    describeRoute({
        tags: ["feedback"],
        summary: "List feedback",
        operationId: "listFeedback",
        description:
            "Paginated list of ideas and bug reports. Unresolved items come first, closed and rejected ones last; newest first within each. Requires authentication.",
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

        const rows = await selectFeedbackItems(db, userId)
            .where(where)
            .orderBy(
                asc(
                    inArray(schema.feedback.status, RESOLVED_FEEDBACK_STATUSES),
                ),
                desc(schema.feedback.createdAt),
                desc(schema.feedback.id),
            )
            .limit(pageSize)
            .offset(getPageOffset(page, pageSize));

        const items = rows.map((row) =>
            serializeFeedbackItem(row, userId),
        ) satisfies z.infer<typeof feedbackItemSchema>[];

        return c.json({
            totalCount,
            pages: totalPages,
            nextPage: getNextPage(page, totalPages),
            items,
        } satisfies z.infer<typeof feedbackListResponseSchema>);
    },
);
