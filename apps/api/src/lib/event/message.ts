import { schema } from "@photon/db";
import { and, eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { AppContext } from "~/lib/ctx";
import { env } from "~/lib/env";
import type { SendNotificationOptions } from "~/lib/notification";
import { DEFAULT_STATUSES } from "./access";

export const EVENT_MESSAGE_TITLE_MAX = 80;
export const EVENT_MESSAGE_BODY_MAX = 1000;

export type EventMessageContent = {
    title: string;
    body: string;
};

type MessageEvent = {
    id: string;
    title: string;
    slug: string;
    organizer: { name: string; contactEmail: string | null } | null;
    contactPerson: { email: string } | null;
};

export async function findMessageEvent(
    ctx: Pick<AppContext, "db">,
    eventId: string,
): Promise<MessageEvent> {
    const event = await ctx.db.query.event.findFirst({
        where: { id: eventId },
        columns: { id: true, title: true, slug: true },
        with: {
            organizer: { columns: { name: true, contactEmail: true } },
            contactPerson: { columns: { email: true } },
        },
    });

    if (!event) {
        throw new HTTPException(404, { message: "Event not found" });
    }

    return event;
}

export async function findRecipientIds(
    ctx: Pick<AppContext, "db">,
    eventId: string,
): Promise<string[]> {
    const rows = await ctx.db
        .select({ userId: schema.eventRegistration.userId })
        .from(schema.eventRegistration)
        .where(
            and(
                eq(schema.eventRegistration.eventId, eventId),
                inArray(schema.eventRegistration.status, [...DEFAULT_STATUSES]),
            ),
        );

    return rows.map((row) => row.userId);
}

/**
 * The notification every recipient gets. The event title goes first so a
 * push on a locked screen says which event it is about.
 */
export function buildEventMessageNotification(
    event: MessageEvent,
    content: EventMessageContent,
    userId: string,
    { test = false }: { test?: boolean } = {},
): SendNotificationOptions {
    const title = `${test ? "[Test] " : ""}${event.title}: ${content.title}`;
    const link = `/arrangementer/${event.slug}`;

    return {
        userId,
        title,
        description: content.body,
        link,
        sendTo: { website: !test, email: true, push: true },
        // The arranger's own address is not ours to hand out, so replies go
        // to whoever the event names as its contact.
        replyTo:
            event.contactPerson?.email ??
            event.organizer?.contactEmail ??
            undefined,
        emailTemplate: {
            name: "EventMessageEmail",
            props: {
                title: content.title,
                body: content.body,
                eventTitle: event.title,
                senderName: event.organizer?.name ?? "TIHLDE",
                link: `${env.WEBSITE_URL}${link}`,
                logoUrl: `${env.WEBSITE_URL}/logo512.png`,
            },
        },
    };
}
