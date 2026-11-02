import { schema } from "@photon/db";
import type z from "zod";
import {
    EVENT_ARRANGER_PERMISSIONS,
    requireEventAccess,
} from "~/lib/event/access";
import { findMessageEvent, findRecipientIds } from "~/lib/event/message";
import { isEventOwner } from "~/lib/event/middleware";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { eventMessageListSchema } from "./schema";

export const listEventMessagesRoute = route().get(
    "/:eventId/messages",
    describeRoute({
        tags: ["events"],
        summary: "List messages sent to an event's participants",
        operationId: "listEventMessages",
        description:
            "Everything the arrangers have sent to the participants, newest first, along with how many a new message would reach. Same access as editing the event.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: eventMessageListSchema,
            description: "OK",
        })
        .unauthorized({ description: "Authentication required" })
        .forbidden({
            description:
                "Requires events:update or events:manage for the arranging group, or being the event's creator",
        })
        .notFound({ description: "Event not found" })
        .build(),
    requireAuth,
    requireEventAccess({
        permission: [...EVENT_ARRANGER_PERMISSIONS],
        ownership: isEventOwner,
    }),
    async (c) => {
        const ctx = c.get("ctx");
        const eventId = c.req.param("eventId");

        await findMessageEvent(ctx, eventId);

        const [recipients, messages] = await Promise.all([
            findRecipientIds(ctx, eventId),
            ctx.db.query.eventMessage.findMany({
                where: { eventId },
                orderBy: { createdAt: "desc" },
                with: { sentBy: { columns: { id: true, name: true } } },
            }),
        ]);

        return c.json({
            recipientCount: recipients.length,
            messages: messages.map((message) => ({
                id: message.id,
                title: message.title,
                body: message.body,
                recipientCount: message.recipientCount,
                sentBy: message.sentBy,
                createdAt: message.createdAt.toISOString(),
            })),
        } satisfies z.infer<typeof eventMessageListSchema>);
    },
);
