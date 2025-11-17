import { and, eq } from "drizzle-orm";
import { describeRoute, resolver } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import z from "zod";
import { schema } from "~/db";
import { route } from "../../lib/route";
import { requireAuth } from "../../middleware/auth";

const deleteNotificationResponseSchema = z.object({
    success: z
        .boolean()
        .meta({ description: "Whether deletion was successful" }),
});

const deleteNotificationSchemaOpenApi = await resolver(
    deleteNotificationResponseSchema,
).toOpenAPISchema();

export const deleteNotificationRoute = route().delete(
    "/:id",
    describeRoute({
        tags: ["notifications"],
        summary: "Delete notification",
        operationId: "deleteNotification",
        description:
            "Delete a notification by ID. User must be authenticated and own the notification.",
        responses: {
            200: {
                description: "Notification deleted successfully",
                content: {
                    "application/json": {
                        schema: deleteNotificationSchemaOpenApi.schema,
                    },
                },
            },
            404: {
                description: "Notification not found or not owned by user",
            },
            401: {
                description: "Unauthorized - user not authenticated",
            },
        },
    }),
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
