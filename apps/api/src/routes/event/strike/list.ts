import { schema } from "@photon/db";
import { desc, eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import z from "zod";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import {
    PaginationSchema,
    getPageOffset,
    getTotalPages,
} from "~/middleware/pagination";
import { strikeListResponseSchema } from "./schema";

export const listStrikesRoute = route().get(
    "/strikes",
    describeRoute({
        tags: ["strikes"],
        summary: "List strikes",
        operationId: "listStrikes",
        description:
            "Retrieve a paginated list of all strikes (prikker), including the affected user and the related event. Optionally filter by user. Requires 'events:strikes:view' or 'events:manage' permission.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: strikeListResponseSchema,
            description: "OK",
        })
        .forbidden({
            description:
                "Requires events:strikes:view or events:manage permission",
        })
        .build(),
    requireAuth,
    requireAccess({ permission: ["events:strikes:view", "events:manage"] }),
    validator(
        "query",
        PaginationSchema.extend({
            userId: z.string().optional().describe("Filter strikes by user ID"),
        }),
    ),
    async (c) => {
        const { db } = c.get("ctx");
        const { pageSize, page, userId } = c.req.valid("query");

        const pageOffset = getPageOffset(page, pageSize);
        const filters = userId
            ? eq(schema.eventStrike.userId, userId)
            : undefined;

        const totalCount = await db.$count(schema.eventStrike, filters);

        const strikes = await db.query.eventStrike.findMany({
            where: filters,
            orderBy: (s) => [desc(s.createdAt)],
            limit: pageSize,
            offset: pageOffset,
            with: {
                user: {
                    columns: { id: true, name: true, image: true },
                },
                event: {
                    columns: { id: true, title: true },
                },
            },
        });

        const totalPages = getTotalPages(totalCount, pageSize);

        return c.json({
            totalCount,
            pages: totalPages,
            nextPage: page + 1 > totalPages ? null : page + 1,
            strikes: strikes.map((strike) => ({
                id: strike.id,
                userId: strike.userId,
                eventId: strike.eventId,
                count: strike.count,
                reason: strike.reason,
                createdAt: strike.createdAt.toISOString(),
                user: strike.user,
                event: strike.event,
            })),
        } satisfies z.infer<typeof strikeListResponseSchema>);
    },
);
