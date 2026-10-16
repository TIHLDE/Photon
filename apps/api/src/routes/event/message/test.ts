import { validator } from "hono-openapi";
import {
    EVENT_ARRANGER_PERMISSIONS,
    requireEventAccess,
} from "~/lib/event/access";
import {
    buildEventMessageNotification,
    findMessageEvent,
} from "~/lib/event/message";
import { isEventOwner } from "~/lib/event/middleware";
import { sendNotification } from "~/lib/notification";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { eventMessageContentSchema } from "./schema";

export const testEventMessageRoute = route().post(
    "/:eventId/messages/test",
    describeRoute({
        tags: ["events"],
        summary: "Send a test of an event message to yourself",
        operationId: "testEventMessage",
        description:
            "Sends the message as an email and a push to the caller only, with «[Test]» in front of the title. Nothing is saved, and the bell is left alone.",
    })
        .response({ statusCode: 204, description: "Test handed to the queues" })
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
    validator("json", eventMessageContentSchema),
    async (c) => {
        const ctx = c.get("ctx");
        const user = c.get("user");
        const content = c.req.valid("json");

        const event = await findMessageEvent(ctx, c.req.param("eventId"));

        await sendNotification(
            buildEventMessageNotification(event, content, user.id, {
                test: true,
            }),
            ctx,
        );

        return c.body(null, 204);
    },
);
