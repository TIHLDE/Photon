import z from "zod";
import {
    EVENT_MESSAGE_BODY_MAX,
    EVENT_MESSAGE_TITLE_MAX,
} from "~/lib/event/message";
import { Schema } from "~/lib/openapi";

export const eventMessageContentSchema = Schema(
    "EventMessageContent",
    z.object({
        title: z.string().trim().min(1).max(EVENT_MESSAGE_TITLE_MAX).meta({
            description:
                "Short headline. The event title is put in front of it in the email subject, the push and the bell.",
        }),
        body: z.string().trim().min(1).max(EVENT_MESSAGE_BODY_MAX).meta({
            description: "Plain text. Line breaks are kept in the email.",
        }),
    }),
);

export const eventMessageSchema = Schema(
    "EventMessage",
    z.object({
        id: z.string(),
        title: z.string(),
        body: z.string(),
        recipientCount: z.number().int(),
        sentBy: z.object({ id: z.string(), name: z.string() }).nullable(),
        createdAt: z.string(),
    }),
);

export const eventMessageListSchema = Schema(
    "EventMessageList",
    z.object({
        recipientCount: z.number().int().meta({
            description:
                "How many would get a message sent right now: everyone holding a spot.",
        }),
        messages: z.array(eventMessageSchema),
    }),
);
