import { schema } from "@photon/db";
import { and, eq, gt, isNull, lt } from "drizzle-orm";
import type { AppContext } from "../ctx";
import { issueStrike } from "./strikes";

/** Strikes given to a user who did not show up to an event. */
export const NO_SHOW_STRIKE_COUNT = 2;

/**
 * Only events that ended within this window are considered. Events older than
 * this that were never checked in are given up on, so they are not rescanned
 * forever.
 */
export const NO_SHOW_LOOKBACK_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

const NO_SHOW_REASON = "Møtte ikke opp på arrangementet";

/**
 * Issue no-show strikes for a single ended event (hybrid model):
 * - Only acts if at least one registration was checked in (`attended`). If no
 *   check-in happened, the event is left unprocessed so a later run can pick it
 *   up once an organizer performs check-in.
 * - Every remaining `registered` user is flipped to `no_show` and given strikes.
 * - Marks the event processed so strikes are issued at most once.
 */
export async function processEventNoShows(
    eventId: string,
    ctx: AppContext,
): Promise<{ processed: boolean; struck: number }> {
    return ctx.db.transaction(async (tx) => {
        const registrations = await tx.query.eventRegistration.findMany({
            columns: { userId: true, status: true },
            where: eq(schema.eventRegistration.eventId, eventId),
        });

        const someoneCheckedIn = registrations.some(
            (r) => r.status === "attended",
        );

        // Hybrid gate: without any check-in we cannot tell attendees from
        // no-shows, so skip (and leave unprocessed) rather than strike everyone.
        if (!someoneCheckedIn) {
            return { processed: false, struck: 0 };
        }

        const noShows = registrations.filter(
            (r) => r.status === "registered" || r.status === "no_show",
        );

        let struck = 0;
        for (const reg of noShows) {
            if (reg.status === "registered") {
                await tx
                    .update(schema.eventRegistration)
                    .set({ status: "no_show" })
                    .where(
                        and(
                            eq(schema.eventRegistration.userId, reg.userId),
                            eq(schema.eventRegistration.eventId, eventId),
                        ),
                    );
            }

            const created = await issueStrike(tx, {
                eventId,
                userId: reg.userId,
                count: NO_SHOW_STRIKE_COUNT,
                reason: NO_SHOW_REASON,
            });
            if (created) {
                struck += 1;
            }
        }

        await tx
            .update(schema.event)
            .set({ noShowProcessedAt: new Date() })
            .where(eq(schema.event.id, eventId));

        return { processed: true, struck };
    });
}

/**
 * Scan for events that have ended and issue no-show strikes for each. Skips
 * events that already were processed, that cannot cause strikes, or that ended
 * outside the lookback window.
 */
export async function processNoShowStrikesForEndedEvents(
    ctx: AppContext,
): Promise<void> {
    const now = new Date();
    const lookbackCutoff = new Date(
        now.getTime() - NO_SHOW_LOOKBACK_DAYS * DAY_MS,
    );

    const endedEvents = await ctx.db.query.event.findMany({
        columns: { id: true },
        where: and(
            eq(schema.event.canCauseStrikes, true),
            isNull(schema.event.noShowProcessedAt),
            lt(schema.event.end, now),
            gt(schema.event.end, lookbackCutoff),
        ),
    });

    for (const event of endedEvents) {
        try {
            await processEventNoShows(event.id, ctx);
        } catch (error) {
            console.error(
                `Error processing no-show strikes for event ${event.id}:`,
                error,
            );
        }
    }
}
