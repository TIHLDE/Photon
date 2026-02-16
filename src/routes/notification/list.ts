import { desc, eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import z from "zod";
import { describeRoute } from "~/lib/openapi";
import {
    PaginationSchema,
    PagniationResponseSchema,
    getPageOffset,
    getTotalPages,
} from "~/middleware/pagination";
import { schema } from "../../db";
import { route } from "../../lib/route";
import { requireAuth } from "../../middleware/auth";

const notificationSchema = z.object({
    id: z.string().meta({ description: "Notification ID" }),
    userId: z.string().meta({ description: "User ID" }),
    title: z.string().meta({ description: "Notification title" }),
    description: z.string().meta({ description: "Notification description" }),
    link: z
        .string()
        .nullable()
        .meta({ description: "Optional link URL (nullable)" }),
    isRead: z.boolean().meta({ description: "Whether notification is read" }),
    createdAt: z.iso
        .datetime()
        .meta({ description: "Notification creation time (ISO 8601)" }),
    updatedAt: z.iso
        .datetime()
        .meta({ description: "Notification update time (ISO 8601)" }),
});

const ResponseSchema = PagniationResponseSchema.extend({
    items: z.array(notificationSchema).describe("List of notifications"),
});

export const listNotificationsRoute = route().get(
    "/",
    describeRoute({
        tags: ["notifications"],
        summary: "List notifications for authenticated user",
        operationId: "listNotifications",
        description:
            "Returns paginated list of notifications for the authenticated user, ordered by most recent first",
    })
        .schemaResponse({
            statusCode: 200,
            schema: ResponseSchema,
            description: "OK",
        })
        .build(),
    requireAuth,
    validator("query", PaginationSchema),
    async (c) => {
        const { db } = c.get("ctx");
        const userId = c.get("user").id;
        const { pageSize, page } = c.req.valid("query");
        const pageOffset = getPageOffset(page, pageSize);

        const notificationFilter = eq(schema.notification.userId, userId);

        const notificationCount = await db.$count(
            schema.notification,
            notificationFilter,
        );

        const totalPages = getTotalPages(notificationCount, pageSize);

        const notifications = await db.query.notification.findMany({
            orderBy: desc(schema.notification.createdAt),
            where: notificationFilter,
            limit: pageSize,
            offset: pageOffset,
        });

        const returnNotifications = notifications.map((n) => ({
            id: n.id,
            userId: n.userId,
            title: n.title,
            description: n.description,
            link: n.link,
            isRead: n.isRead,
            createdAt: n.createdAt.toISOString(),
            updatedAt: n.updatedAt.toISOString(),
        }));

        return c.json({
            totalCount: notificationCount,
            pages: totalPages,
            nextPage: page + 1 > totalPages ? null : page + 1,
            items: returnNotifications,
        } satisfies z.infer<typeof ResponseSchema>);
    },
);
