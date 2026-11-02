import { schema } from "@photon/db";
import { EmptyFilter, and, eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import type { z } from "zod";
import { describeRoute } from "~/lib/openapi";
import {
    getNextPage,
    getPageOffset,
    getTotalPages,
} from "~/middleware/pagination";
import { route } from "../../lib/route";
import { requireAuth } from "../../middleware/auth";
import {
    notificationListQuerySchema,
    notificationListResponseSchema,
} from "./schema";

export const listNotificationsRoute = route().get(
    "/",
    describeRoute({
        tags: ["notifications"],
        summary: "List notifications for authenticated user",
        operationId: "listNotifications",
        description:
            "Returns paginated list of notifications for the authenticated user, ordered by most recent first. Pass isRead=false to count unread ones: totalCount answers that without fetching the notifications themselves.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: notificationListResponseSchema,
            description: "OK",
        })
        .build(),
    requireAuth,
    validator("query", notificationListQuerySchema),
    async (c) => {
        const { db } = c.get("ctx");
        const userId = c.get("user").id;
        const { pageSize, page, isRead } = c.req.valid("query");
        const pageOffset = getPageOffset(page, pageSize);

        const notificationFilter = (notification: typeof schema.notification) =>
            and(
                eq(notification.userId, userId),
                isRead === undefined
                    ? undefined
                    : eq(notification.isRead, isRead),
            );

        const notificationCount = await db.$count(
            schema.notification,
            notificationFilter(schema.notification),
        );

        const totalPages = getTotalPages(notificationCount, pageSize);

        const notifications = await db.query.notification.findMany({
            orderBy: { createdAt: "desc" },
            where: {
                RAW: (notification) =>
                    notificationFilter(notification) ?? EmptyFilter,
            },
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
            nextPage: getNextPage(page, totalPages),
            items: returnNotifications,
        } satisfies z.infer<typeof notificationListResponseSchema>);
    },
);
