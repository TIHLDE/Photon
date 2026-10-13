import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { describeRoute } from "~/lib/openapi";
import { route } from "../../lib/route";
import { requireAuth } from "../../middleware/auth";
import { markAllReadResponseSchema } from "./schema";

export const markAllReadNotificationsRoute = route().patch(
    "/read-all",
    describeRoute({
        tags: ["notifications"],
        summary: "Mark all notifications as read",
        operationId: "markAllNotificationsRead",
        description:
            "Mark every unread notification of the authenticated user as read. Returns how many notifications were updated.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: markAllReadResponseSchema,
            description: "Notifications updated successfully",
        })
        .build(),
    requireAuth,
    async (c) => {
        const { db } = c.get("ctx");
        const userId = c.get("user").id;

        const updated = await db
            .update(schema.notification)
            .set({ isRead: true })
            .where(
                and(
                    eq(schema.notification.userId, userId),
                    eq(schema.notification.isRead, false),
                ),
            )
            .returning({ id: schema.notification.id });

        return c.json({ updatedCount: updated.length });
    },
);
