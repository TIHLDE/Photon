import { schema } from "@photon/db";
import { and, eq, isNotNull } from "drizzle-orm";
import type { AppContext } from "~/lib/ctx";
import { HTTPAppException } from "~/lib/errors";
import { findRecipientIds } from "~/lib/event/message";
import type { LoggerType } from "~/lib/logger";
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
    /** Whether this was the event's first publish, and so notified the attendees. */
    isFirstPublish: boolean;
    recipientCount: number;
};

/**
 * Put the story live. The first publish of an event, and only that one,
 * notifies everyone who held a spot on it, in the bell and by push.
 * Unpublishing and publishing again, or publishing a story that is already
 * live, notifies nobody: `first_published_at` is never cleared, and the first
 * notifications stay in the members' bells.
 *
 * The camera row is locked for the decision, so two quick clicks cannot both
 * see a story that was never published and notify everyone twice. The
 * notifications are sent after the commit: a rollback must not leave a push
 * about a story that never went live.
 */
export async function publishStory(
    ctx: AppContext,
    eventId: string,
    logger: LoggerType,
    now: Date = new Date(),
): Promise<PublishResult> {
    const event = await ctx.db.query.event.findFirst({
        where: { id: eventId },
        columns: { id: true, title: true, slug: true },
    });
    if (!event) {
        throw HTTPAppException.NotFound("Event");
    }

    const { isFirstPublish, recipientIds } = await ctx.db.transaction(
        async (tx) => {
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
                logger.warn(
                    { eventId },
                    "Wrapped story publish refused: no photos picked",
                );
                throw HTTPAppException.Conflict(
                    "Velg minst ett bilde før du publiserer storyen.",
                );
            }

            const isFirstPublish = camera.firstPublishedAt === null;
            await tx
                .update(schema.wrappedCamera)
                .set({
                    // Publishing a live story keeps the time it went live.
                    publishedAt: camera.publishedAt ?? now,
                    ...(isFirstPublish ? { firstPublishedAt: now } : {}),
                    updatedAt: now,
                })
                .where(eq(schema.wrappedCamera.eventId, eventId));

            return {
                isFirstPublish,
                recipientIds: isFirstPublish
                    ? await findRecipientIds({ db: tx }, eventId)
                    : [],
            };
        },
    );

    if (isFirstPublish) {
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
        // A crash between the commit and the flush loses the notification for
        // good (accepted, same trade-off as event messages).
        try {
            await notifications.flush(ctx);
            logger.info(
                { eventId, recipientCount: recipientIds.length },
                "Wrapped story notifications queued",
            );
        } catch (err) {
            logger.error(
                { err, eventId },
                "Wrapped story notifications failed after publish",
            );
        }
    }

    return { isFirstPublish, recipientCount: recipientIds.length };
}

/**
 * Take the story down. Only `published_at` is cleared: `first_published_at`
 * stays, so publishing again notifies nobody, and the notifications already in
 * the members' bells stay too. Likes and comments stay, so publishing again
 * brings the story back as it was.
 *
 * A bell or push item opened while the story is unpublished lands on the story
 * page, which says the story is not published.
 */
export async function unpublishStory(
    ctx: AppContext,
    eventId: string,
): Promise<void> {
    const event = await ctx.db.query.event.findFirst({
        where: { id: eventId },
        columns: { id: true },
    });
    if (!event) {
        throw HTTPAppException.NotFound("Event");
    }

    await ctx.db
        .update(schema.wrappedCamera)
        .set({ publishedAt: null, updatedAt: new Date() })
        .where(eq(schema.wrappedCamera.eventId, eventId));
}
