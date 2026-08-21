import { randomUUID } from "node:crypto";
import { schema } from "@photon/db";
import { inArray } from "drizzle-orm";
import type { AppContext } from "../ctx";
import { env } from "../env";
import { type SendNotificationOptions, sendNotification } from ".";
import { enqueuePushNotifications } from "./push";

/**
 * Notifications decided inside a transaction and sent once it has committed.
 *
 * {@link sendNotification} renders the React Email template inline before it
 * hands the mail to the queue, and writes a notification row of its own.
 * Doing that inside the registration resolver's transaction stretched how long
 * its `FOR UPDATE` locks were held by one template render per affected member —
 * on a full event, that is the whole waitlist.
 *
 * It was also wrong on rollback: the mail was already queued for a placement
 * that never committed. Deciding inside the transaction and sending after it
 * is the same shape the refund path already uses.
 */
export type DeferredNotifications = {
    /** Queue a notification to be sent after the transaction commits. */
    add(options: SendNotificationOptions): void;
    /**
     * Send everything queued so far. One failure does not stop the rest: the
     * database work is already committed, and a member who does not get an
     * email still has their spot.
     */
    flush(ctx: AppContext): Promise<void>;
};

/** Whether a channel is on for this notification; all three default to on. */
function channels(options: SendNotificationOptions) {
    return {
        website: options.sendTo?.website ?? true,
        email: options.sendTo?.email ?? true,
        push: options.sendTo?.push ?? true,
    };
}

/**
 * Absolute link for the email templates. A relative href has no origin to
 * resolve against in a mail client, which makes the "Se mer" button dead.
 */
function toAbsoluteLink(link: string | undefined) {
    if (!link) return link;
    if (/^[a-z][a-z0-9+.-]*:/i.test(link)) return link;
    return `${env.WEBSITE_URL}${link.startsWith("/") ? "" : "/"}${link}`;
}

/**
 * Send the batch in as few round trips as the channels allow: one insert for
 * every notification row, one query for the addresses, one enqueue for the
 * mails and one for the pushes.
 *
 * It matters because of who is waiting. The member being notified already has
 * their answer — this runs after the commit. But it runs inside the resolver's
 * queue job, and the worker takes one job at a time, so everyone who signed up
 * while this batch was being decided waits behind these round trips. During the
 * immatrikuleringsball opening that was ~620 of them, in the busiest seconds
 * the API had.
 *
 * The row ids are generated here rather than left to the database, so a push
 * can carry the id of its own notification without matching rows up by
 * position afterwards.
 */
async function flushInBatch(
    ctx: AppContext,
    queued: SendNotificationOptions[],
): Promise<void> {
    const entries = queued.map((options) => ({
        options,
        channels: channels(options),
        id: randomUUID(),
    }));

    const rows = entries
        .filter((entry) => entry.channels.website)
        .map((entry) => ({
            id: entry.id,
            userId: entry.options.userId,
            title: entry.options.title,
            description: entry.options.description,
            link: entry.options.link ?? null,
            isRead: false,
        }));

    if (rows.length > 0) {
        await ctx.db.insert(schema.notification).values(rows);
    }

    const mailed = entries.filter((entry) => entry.channels.email);

    if (mailed.length > 0) {
        const userIds = [...new Set(mailed.map((e) => e.options.userId))];
        const users = await ctx.db
            .select({
                id: schema.user.id,
                email: schema.user.email,
            })
            .from(schema.user)
            .where(inArray(schema.user.id, userIds));

        const emailOf = new Map(users.map((user) => [user.id, user.email]));

        await ctx.email.sendEmailTemplates(
            mailed.flatMap((entry) => {
                const to = emailOf.get(entry.options.userId);
                if (!to) {
                    console.error(
                        `No email address for user ${entry.options.userId}; skipping "${entry.options.title}"`,
                    );
                    return [];
                }

                const template = entry.options.emailTemplate ?? {
                    name: "NotificationMail" as const,
                    props: {
                        title: entry.options.title,
                        description: entry.options.description,
                        link: toAbsoluteLink(entry.options.link),
                        logoUrl: `${env.WEBSITE_URL}/logo512.png`,
                    },
                };

                return [
                    {
                        options: {
                            from: env.MAIL_FROM,
                            to,
                            subject: entry.options.title,
                        },
                        templateName: template.name,
                        templateProps: template.props,
                    },
                ];
            }),
        );
    }

    await enqueuePushNotifications(
        entries
            .filter((entry) => entry.channels.push)
            .map((entry) => ({
                userId: entry.options.userId,
                title: entry.options.title,
                body: entry.options.description,
                link: entry.options.link,
                notificationId: entry.channels.website ? entry.id : null,
            })),
        ctx,
    );
}

export function createDeferredNotifications(): DeferredNotifications {
    const pending: SendNotificationOptions[] = [];

    return {
        add(options) {
            pending.push(options);
        },
        async flush(ctx) {
            const queued = pending.splice(0, pending.length);
            if (queued.length === 0) return;

            try {
                await flushInBatch(ctx, queued);
                return;
            } catch (error) {
                // The batch is all-or-nothing, so a single bad entry would
                // cost everyone else their notification. Fall back to sending
                // them one by one, which survives one failure — the same
                // behaviour this had before it was batched.
                console.error(
                    "Batched notification flush failed, falling back to one at a time:",
                    error,
                );
            }

            for (const options of queued) {
                try {
                    await sendNotification(options, ctx);
                } catch (error) {
                    console.error(
                        `Failed to send notification "${options.title}" to user ${options.userId}:`,
                        error,
                    );
                }
            }
        },
    };
}
