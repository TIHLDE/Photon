import z from "zod";
import { Schema } from "~/lib/openapi";
import { PagniationResponseSchema } from "~/middleware/pagination";

// ===== INPUT SCHEMAS =====

export const markReadSchema = z.object({
    isRead: z
        .boolean()
        .meta({ description: "Whether notification should be marked as read" }),
});

// ===== RESPONSE SCHEMAS =====

export const notificationSchema = Schema(
    "Notification",
    z.object({
        id: z.string().meta({ description: "Notification ID" }),
        userId: z.string().meta({ description: "User ID" }),
        title: z.string().meta({ description: "Notification title" }),
        description: z
            .string()
            .meta({ description: "Notification description" }),
        link: z
            .string()
            .nullable()
            .meta({ description: "Optional link URL (nullable)" }),
        isRead: z
            .boolean()
            .meta({ description: "Whether notification is read" }),
        createdAt: z.iso
            .datetime()
            .meta({ description: "Notification creation time (ISO 8601)" }),
        updatedAt: z.iso
            .datetime()
            .meta({ description: "Notification update time (ISO 8601)" }),
    }),
);

export const notificationListResponseSchema = Schema(
    "NotificationList",
    PagniationResponseSchema.extend({
        items: z
            .array(notificationSchema)
            .describe("List of notifications"),
    }),
);

export const markReadResponseSchema = Schema(
    "MarkReadResponse",
    z.object({
        id: z.string().meta({ description: "Notification ID" }),
        isRead: z.boolean().meta({ description: "Updated read status" }),
        updatedAt: z.iso
            .datetime()
            .meta({ description: "Notification update time (ISO 8601)" }),
    }),
);

export const deleteNotificationResponseSchema = Schema(
    "DeleteNotificationResponse",
    z.object({
        success: z
            .boolean()
            .meta({ description: "Whether deletion was successful" }),
    }),
);
