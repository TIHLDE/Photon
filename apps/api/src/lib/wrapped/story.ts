import { schema } from "@photon/db";
import { and, eq, isNotNull } from "drizzle-orm";
import type { AppContext } from "~/lib/ctx";
import { HTTPAppException } from "~/lib/errors";
import { findRecipientIds } from "~/lib/event/message";
import { createDeferredNotifications } from "~/lib/notification/deferred";
import { submittedOnly } from ".";

/** Where kvark shows the story. The notification links here. */
export function storyPath(slug: string): string {
    return `/arrangementer/${slug}/story`;
}

/**
 * Picked photos only: the organizer's selection is the story. Every story
 * query goes through this condition.
 */
export function inStory() {
    return and(submittedOnly(), isNotNull(schema.wrappedPhoto.selectedAt));
}

export type PublishResult = {
    /** Whether this publish put the story live, and so notified the attendees. */
    notified: boolean;
    recipientCount: number;
};

/**
 * Put the story live, and notify everyone who held a spot on the event, in
 * the bell and by push. Every publish that takes the story from unpublished
 * to live notifies: unpublishing deletes the notifications, so there is never
 * more than one waiting in a member's bell. Publishing a story that is
 * already live notifies nobody.
 *
 * The camera row is locked for the decision, so two quick clicks cannot both
 * see the story as unpublished and notify everyone twice. The notifications
 * are sent after the commit: a rollback must not leave a push about a story
 * that never went live.
 */
export async function publishStory(
    ctx: AppContext,
    eventId: string,
    now: Date = new Date(),
): Promise<PublishResult> {
    const event = await ctx.db.query.event.findFirst({
        where: { id: eventId },
        columns: { id: true, title: true, slug: true },
    });
    if (!event) {
        throw HTTPAppException.NotFound("Event");
    }

    const { goesLive, recipientIds } = await ctx.db.transaction(async (tx) => {
        const [camera] = await tx
            .select({
                publishedAt: schema.wrappedCamera.publishedAt,
                firstPublishedAt: schema.wrappedCamera.firstPublishedAt,
            })
            .from(schema.wrappedCamera)
            .where(eq(schema.wrappedCamera.eventId, eventId))
            .for("update");

        const picked = camera
            ? await tx.$count(
                  schema.wrappedPhoto,
                  and(eq(schema.wrappedPhoto.eventId, eventId), inStory()),
              )
            : 0;
        if (!camera || picked === 0) {
            throw HTTPAppException.Conflict(
                "Pick at least one photo before publishing the story",
            );
        }

        const goesLive = camera.publishedAt === null;
        await tx
            .update(schema.wrappedCamera)
            .set({
                publishedAt: now,
                ...(camera.firstPublishedAt === null
                    ? { firstPublishedAt: now }
                    : {}),
                updatedAt: now,
            })
            .where(eq(schema.wrappedCamera.eventId, eventId));

        return {
            goesLive,
            recipientIds: goesLive
                ? await findRecipientIds({ db: tx }, eventId)
                : [],
        };
    });

    if (goesLive) {
        const notifications = createDeferredNotifications();
        for (const userId of recipientIds) {
            notifications.add({
                userId,
                title: `Wrapped fra ${event.title} er klar`,
                description: "Se bildene fra arrangementet",
                link: storyPath(event.slug),
                sendTo: { website: true, push: true, email: false },
            });
        }
        await notifications.flush(ctx);
    }

    return { notified: goesLive, recipientCount: recipientIds.length };
}

/**
 * Take the story down, and the notifications about it with it: a
 * notification that opens a story members can no longer see is a dead end.
 * Likes and comments stay, so publishing again brings the story back as it
 * was — and notifies the attendees again.
 *
 * A push that has already reached a phone cannot be taken back. Opening it
 * lands on the story page, which says the story is not published.
 */
export async function unpublishStory(
    ctx: AppContext,
    eventId: string,
): Promise<{ removedNotifications: number }> {
    const event = await ctx.db.query.event.findFirst({
        where: { id: eventId },
        columns: { slug: true },
    });
    if (!event) {
        throw HTTPAppException.NotFound("Event");
    }

    return ctx.db.transaction(async (tx) => {
        await tx
            .update(schema.wrappedCamera)
            .set({ publishedAt: null, updatedAt: new Date() })
            .where(eq(schema.wrappedCamera.eventId, eventId));

        // The story link is the event's own, so it matches only this story's
        // notifications, for every member who got one.
        const removed = await tx
            .delete(schema.notification)
            .where(eq(schema.notification.link, storyPath(event.slug)))
            .returning({ id: schema.notification.id });

        return { removedNotifications: removed.length };
    });
}
