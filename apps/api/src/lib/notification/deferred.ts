import type { AppContext } from "../ctx";
import { type SendNotificationOptions, sendNotification } from ".";

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

export function createDeferredNotifications(): DeferredNotifications {
    const pending: SendNotificationOptions[] = [];

    return {
        add(options) {
            pending.push(options);
        },
        async flush(ctx) {
            const queued = pending.splice(0, pending.length);

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
