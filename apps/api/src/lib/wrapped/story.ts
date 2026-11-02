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
    /** Whether this publish was the first, and so notified the attendees. */
    notified: boolean;
    recipientCount: number;
};

/**
 * Put the story live. The first publish notifies everyone who held a spot on
 * the event, in the bell and by push; publishing again after an unpublish
 * notifies nobody.
 *
 * The camera row is locked for the decision, so two quick clicks cannot both
 * see `first_published_at` as null and notify everyone twice. The
 * notifications are sent after the commit: a rollback must not leave a push
 * about a story that never went live.
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

    const { first, recipientIds } = await ctx.db.transaction(async (tx) => {
        const [camera] = await tx
            .select({
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

        const first = camera.firstPublishedAt === null;
        await tx
            .update(schema.wrappedCamera)
            .set({
                publishedAt: now,
                ...(first ? { firstPublishedAt: now } : {}),
                updatedAt: now,
            })
            .where(eq(schema.wrappedCamera.eventId, eventId));

        return {
            first,
            recipientIds: first
                ? await findRecipientIds({ db: tx }, eventId)
                : [],
        };
    });

    if (first) {
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

    return { notified: first, recipientCount: recipientIds.length };
}

/**
 * Take the story down. Likes and comments stay, so publishing again brings it
 * back as it was.
 */
export async function unpublishStory(
    ctx: AppContext,
    eventId: string,
): Promise<void> {
    await ctx.db
        .update(schema.wrappedCamera)
        .set({ publishedAt: null, updatedAt: new Date() })
        .where(eq(schema.wrappedCamera.eventId, eventId));
}
