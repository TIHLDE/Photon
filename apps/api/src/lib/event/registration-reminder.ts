import { schema } from "@photon/db";
import { and, eq, gt, isNotNull, isNull, lte } from "drizzle-orm";
import type { AppContext } from "../ctx";
import { env } from "../env";
import { sendNotification } from "../notification";
import { formatOsloDate, formatOsloDateTime } from "../oslo-day";

/** How long before registration opens the reminder is sent. */
export const REGISTRATION_REMINDER_LEAD_MS = 60 * 60 * 1000;

/**
 * Format an opening time the way it reads in a Norwegian sentence:
 * "12. august kl. 12:00". The stored instant is UTC, so it is rendered in the
 * timezone the events actually happen in.
 */
export function formatRegistrationStart(date: Date): string {
    const day = formatOsloDate(date, { day: "numeric", month: "long" });
    const time = formatOsloDateTime(date, {
        hour: "2-digit",
        minute: "2-digit",
    });

    return `${day} kl. ${time}`;
}

/**
 * Notify everyone who favourited `event` that its registration is about to
 * open. Favouriting is the opt-in: an event without favourites notifies nobody.
 *
 * The event is claimed first — `registration_reminder_sent_at` is stamped in a
 * conditional update — so an overlapping cron tick, or a second API instance,
 * cannot send the same reminder twice. Returns the number of users notified, or
 * null when another run had already claimed the event.
 */
export async function sendRegistrationOpeningReminder(
    eventId: string,
    ctx: AppContext,
): Promise<number | null> {
    const [claimed] = await ctx.db
        .update(schema.event)
        .set({ registrationReminderSentAt: new Date() })
        .where(
            and(
                eq(schema.event.id, eventId),
                isNull(schema.event.registrationReminderSentAt),
            ),
        )
        .returning({
            id: schema.event.id,
            title: schema.event.title,
            slug: schema.event.slug,
            registrationStart: schema.event.registrationStart,
        });

    // Already claimed by another run — nothing to do.
    if (!claimed?.registrationStart) return null;

    const favorites = await ctx.db.query.eventFavorite.findMany({
        columns: { userId: true },
        where: eq(schema.eventFavorite.eventId, eventId),
    });

    const link = `/arrangementer/${claimed.slug}`;
    const eventUrl = `${env.WEBSITE_URL}${link}`;
    const opensAt = formatRegistrationStart(claimed.registrationStart);

    let notified = 0;
    for (const { userId } of favorites) {
        try {
            await sendNotification(
                {
                    userId,
                    title: "Påmeldingen åpner snart",
                    description: `Påmeldingen til ${claimed.title} åpner ${opensAt}.`,
                    link,
                    emailTemplate: {
                        name: "RegistrationOpeningEmail",
                        props: {
                            eventName: claimed.title,
                            eventUrl,
                            registrationStart: opensAt,
                            logoUrl: `${env.WEBSITE_URL}/logo512.png`,
                        },
                    },
                },
                ctx,
            );
            notified += 1;
        } catch (error) {
            // One unreachable user must not cost everyone else their reminder.
            console.error(
                `Error sending registration reminder to user ${userId} for event ${eventId}:`,
                error,
            );
        }
    }

    return notified;
}

/**
 * Scan for events whose registration opens within the lead time and send the
 * reminder to their favouriters.
 *
 * Events whose opening is already in the past are skipped: the reminder is only
 * useful ahead of time, and the guard also stops old events from being mailed
 * out when this feature (or a restarted instance) first sees them.
 */
export async function sendUpcomingRegistrationReminders(
    ctx: AppContext,
): Promise<void> {
    const now = new Date();
    const cutoff = new Date(now.getTime() + REGISTRATION_REMINDER_LEAD_MS);

    const upcoming = await ctx.db.query.event.findMany({
        columns: { id: true },
        where: and(
            eq(schema.event.requiresSigningUp, true),
            eq(schema.event.isRegistrationClosed, false),
            isNull(schema.event.registrationReminderSentAt),
            isNotNull(schema.event.registrationStart),
            gt(schema.event.registrationStart, now),
            lte(schema.event.registrationStart, cutoff),
        ),
    });

    for (const event of upcoming) {
        try {
            await sendRegistrationOpeningReminder(event.id, ctx);
        } catch (error) {
            console.error(
                `Error sending registration reminders for event ${event.id}:`,
                error,
            );
        }
    }
}
