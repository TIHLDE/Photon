import { desc, eq } from "drizzle-orm";
import { describeRoute, resolver } from "hono-openapi";
import z from "zod";
import { schema } from "../../db";
import { route } from "../../lib/route";
import { requireAuth } from "../../middleware/auth";
import { withPagination } from "../../middleware/pagination";

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

const notificationSchemaOpenApi = await resolver(
    z.array(notificationSchema),
).toOpenAPISchema();

export const listNotificationsRoute = route().get(
    "/",
    describeRoute({
        tags: ["notifications"],
        summary: "List notifications for authenticated user",
        description:
            "Returns paginated list of notifications for the authenticated user, ordered by most recent first",
        responses: {
            200: {
                description: "OK",
                content: {
                    "application/json": {
                        schema: notificationSchemaOpenApi.schema,
                    },
                },
            },
            401: {
                description: "Unauthorized - user not authenticated",
            },
        },
    }),
    requireAuth,
    ...withPagination(),
    async (c) => {
        const { db } = c.get("ctx");
        const userId = c.get("user").id;
        const limit = c.get("limit");
        const offset = c.get("offset");

        const notifications = await db.query.notification.findMany({
            where: eq(schema.notification.userId, userId),
            orderBy: desc(schema.notification.createdAt),
            limit,
            offset,
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

        return c.json(returnNotifications);
    },
);
