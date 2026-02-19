import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import z from "zod";
import { describeRoute } from "~/lib/openapi";
import { route } from "../../lib/route";
import { requireAuth } from "../../middleware/auth";

const markReadSchema = z.object({
    isRead: z
        .boolean()
        .meta({ description: "Whether notification should be marked as read" }),
});

const markReadResponseSchema = z.object({
    id: z.string().meta({ description: "Notification ID" }),
    isRead: z.boolean().meta({ description: "Updated read status" }),
    updatedAt: z.iso
        .datetime()
        .meta({ description: "Notification update time (ISO 8601)" }),
});

export const markReadNotificationRoute = route().patch(
    "/:id/read",
    describeRoute({
        tags: ["notifications"],
        summary: "Mark notification as read or unread",
        operationId: "markNotificationRead",
        description:
            "Update the read status of a notification. User must be authenticated and own the notification.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: markReadResponseSchema,
            description: "Notification updated successfully",
        })
        .notFound({
            description: "Notification not found or not owned by user",
        })
        .build(),
    requireAuth,
    validator("json", markReadSchema),
    async (c) => {
        const { db } = c.get("ctx");
        const notificationId = c.req.param("id");
        const userId = c.get("user").id;
        const { isRead } = c.req.valid("json");

        const [updated] = await db
            .update(schema.notification)
            .set({ isRead })
            .where(
                and(
                    eq(schema.notification.id, notificationId),
                    eq(schema.notification.userId, userId),
                ),
            )
            .returning();

        if (!updated) {
            throw new HTTPException(404, {
                message: "Notification not found or not owned by user",
            });
        }

        return c.json({
            id: updated.id,
            isRead: updated.isRead,
            updatedAt: updated.updatedAt.toISOString(),
        });
    },
);
