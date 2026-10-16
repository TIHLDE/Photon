import { schema } from "@photon/db";
import { and, eq, gt } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import type z from "zod";
import {
    EVENT_ARRANGER_PERMISSIONS,
    requireEventAccess,
} from "~/lib/event/access";
import {
    buildEventMessageNotification,
    findMessageEvent,
    findRecipientIds,
} from "~/lib/event/message";
import { isEventOwner } from "~/lib/event/middleware";
import { createDeferredNotifications } from "~/lib/notification/deferred";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { eventMessageContentSchema, eventMessageSchema } from "./schema";

const DUPLICATE_WINDOW_MS = 60_000;

export const sendEventMessageRoute = route().post(
    "/:eventId/messages",
    describeRoute({
        tags: ["events"],
        summary: "Send a message to an event's participants",
        operationId: "sendEventMessage",
        description:
            "Sends a message to everyone holding a spot on the event (registered, attended or no-show — never the waitlist) as a notification in the bell, an email and a push. Replies to the email go to the event's contact person, or the arranging group's contact address. Same access as editing the event.",
    })
        .schemaResponse({
            statusCode: 201,
            schema: eventMessageSchema,
            description:
                "Message saved and handed to the email and push queues",
        })
        .badRequest({ description: "Nobody holds a spot on the event" })
        .unauthorized({ description: "Authentication required" })
        .forbidden({
            description:
                "Requires events:update or events:manage for the arranging group, or being the event's creator",
        })
        .notFound({ description: "Event not found" })
        .response({
            statusCode: 409,
            description:
                "The same message was sent to this event less than a minute ago",
        })
        .build(),
    requireAuth,
    requireEventAccess({
        permission: [...EVENT_ARRANGER_PERMISSIONS],
        ownership: isEventOwner,
    }),
    validator("json", eventMessageContentSchema),
    async (c) => {
        const ctx = c.get("ctx");
        const user = c.get("user");
        const eventId = c.req.param("eventId");
        const content = c.req.valid("json");

        const event = await findMessageEvent(ctx, eventId);

        const { message, recipientIds } = await ctx.db.transaction(
            async (tx) => {
                // Serialises sends per event, so a double click cannot slip
                // two copies past the duplicate check below.
                await tx
                    .select({ id: schema.event.id })
                    .from(schema.event)
                    .where(eq(schema.event.id, eventId))
                    .for("update");

                const duplicate = await tx.query.eventMessage.findFirst({
                    where: and(
                        eq(schema.eventMessage.eventId, eventId),
                        eq(schema.eventMessage.title, content.title),
                        eq(schema.eventMessage.body, content.body),
                        gt(
                            schema.eventMessage.createdAt,
                            new Date(Date.now() - DUPLICATE_WINDOW_MS),
                        ),
                    ),
                    columns: { id: true },
                });

                if (duplicate) {
                    throw new HTTPException(409, {
                        message:
                            "This message was sent to the event less than a minute ago",
                    });
                }

                const recipientIds = await findRecipientIds(
                    { db: tx },
                    eventId,
                );

                if (recipientIds.length === 0) {
                    throw new HTTPException(400, {
                        message: "Nobody holds a spot on this event",
                    });
                }

                const [message] = await tx
                    .insert(schema.eventMessage)
                    .values({
                        eventId,
                        sentById: user.id,
                        title: content.title,
                        body: content.body,
                        recipientCount: recipientIds.length,
                    })
                    .returning();

                if (!message) {
                    throw new HTTPException(500, {
                        message: "Failed to save the message",
                    });
                }

                return { message, recipientIds };
            },
        );

        const notifications = createDeferredNotifications();
        for (const userId of recipientIds) {
            notifications.add(
                buildEventMessageNotification(event, content, userId),
            );
        }
        await notifications.flush(ctx);

        return c.json(
            {
                id: message.id,
                title: message.title,
                body: message.body,
                recipientCount: message.recipientCount,
                sentBy: { id: user.id, name: user.name },
                createdAt: message.createdAt.toISOString(),
            } satisfies z.infer<typeof eventMessageSchema>,
            201,
        );
    },
);
