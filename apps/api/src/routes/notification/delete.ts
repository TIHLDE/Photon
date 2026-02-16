import { requireAuth } from "@photon/auth/server";
import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import z from "zod";
import { describeRoute } from "~/lib/openapi";
import { route } from "../../lib/route";

const deleteNotificationResponseSchema = z.object({
    success: z
        .boolean()
        .meta({ description: "Whether deletion was successful" }),
});

export const deleteNotificationRoute = route().delete(
    "/:id",
    describeRoute({
        tags: ["notifications"],
        summary: "Delete notification",
        operationId: "deleteNotification",
        description:
            "Delete a notification by ID. User must be authenticated and own the notification.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: deleteNotificationResponseSchema,
            description: "Notification deleted successfully",
        })
        .notFound({
            description: "Notification not found or not owned by user",
        })
        .build(),
    requireAuth,
    async (c) => {
        const { db } = c.get("ctx");
        const notificationId = c.req.param("id");
        const userId = c.get("user").id;

        const [deleted] = await db
            .delete(schema.notification)
            .where(
                and(
                    eq(schema.notification.id, notificationId),
                    eq(schema.notification.userId, userId),
                ),
            )
            .returning();

        if (!deleted) {
            throw new HTTPException(404, {
                message: "Notification not found or not owned by user",
            });
        }

        return c.json({ success: true });
    },
);
