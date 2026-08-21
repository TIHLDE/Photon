import type { DbSchema } from "@photon/db";
import { schema } from "@photon/db";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

/**
 * Number of days a strike remains active after it was given.
 * After this period the strike expires and no longer counts towards a user's
 * total (it stops affecting registration timing and prioritization).
 */
export const STRIKE_ACTIVE_DAYS = 20;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Annual freeze periods during which strikes do not age. If a strike is still
 * active when a freeze period begins, it is held (its 20-day active clock is
 * paused) until the period is over. Boundaries are in UTC; hour-level
 * precision is irrelevant for a day-based strike system.
 * - Winter: 29 Nov – 9 Jan (wraps the year boundary)
 * - Summer: 10 May – 15 Aug
 */
function getFreezePeriods(
    fromYear: number,
    toYear: number,
): Array<[number, number]> {
    const periods: Array<[number, number]> = [];
    for (let y = fromYear - 1; y <= toYear + 1; y++) {
        // Summer: 10 May 00:00 → 16 Aug 00:00 (covers through 15 Aug)
        periods.push([Date.UTC(y, 4, 10), Date.UTC(y, 7, 16)]);
        // Winter: 29 Nov 00:00 → 10 Jan 00:00 next year (covers through 9 Jan)
        periods.push([Date.UTC(y, 10, 29), Date.UTC(y + 1, 0, 10)]);
    }
    return periods;
}

/**
 * Total milliseconds within [fromMs, toMs] that fall inside a freeze period.
 */
function frozenMsBetween(fromMs: number, toMs: number): number {
    if (toMs <= fromMs) return 0;
    const fromYear = new Date(fromMs).getUTCFullYear();
    const toYear = new Date(toMs).getUTCFullYear();
    let frozen = 0;
    for (const [start, end] of getFreezePeriods(fromYear, toYear)) {
        const overlapStart = Math.max(fromMs, start);
        const overlapEnd = Math.min(toMs, end);
        if (overlapEnd > overlapStart) {
            frozen += overlapEnd - overlapStart;
        }
    }
    return frozen;
}

/**
 * Returns the cutoff date for active strikes: a strike is active if its
 * `createdAt` is at or after this timestamp. A strike is active until 20
 * non-frozen days have elapsed since it was given, so the cutoff is pushed
 * further back to compensate for any freeze periods in the window.
 */
export function getStrikeActiveCutoff(now: Date = new Date()): Date {
    const activeMs = STRIKE_ACTIVE_DAYS * DAY_MS;
    const nowMs = now.getTime();
    // Fixed-point: cutoff = now - activeMs - frozen(cutoff, now). Extending the
    // cutoff backwards may pull additional freeze periods into the window, so
    // iterate until it stabilizes (converges in a couple of steps).
    let cutoff = nowMs - activeMs;
    for (let i = 0; i < 12; i++) {
        const next = nowMs - activeMs - frozenMsBetween(cutoff, nowMs);
        if (next === cutoff) {
            break;
        }
        cutoff = next;
    }
    return new Date(cutoff);
}

/**
 * Get the total number of currently active strikes a user has accumulated.
 * Strikes older than {@link STRIKE_ACTIVE_DAYS} days are excluded.
 */
export async function getUserStrikeCount(
    userId: string,
    db: NodePgDatabase<DbSchema>,
): Promise<number> {
    const rows = await db
        .select({ count: schema.eventStrike.count })
        .from(schema.eventStrike)
        .where(
            and(
                eq(schema.eventStrike.userId, userId),
                gte(schema.eventStrike.createdAt, getStrikeActiveCutoff()),
            ),
        );

    return rows.reduce((total, row) => total + row.count, 0);
}

/**
 * The same count as {@link getUserStrikeCount}, for a whole batch of members in
 * one query.
 *
 * The registration resolver needs this for every member it decides, and asking
 * per member is what made a busy sign-up slow: 121 round trips, each one
 * scanning `event_strike` in full, while the pass held its `FOR UPDATE` locks.
 *
 * Members with no active strikes are absent from the map — read it with `?? 0`.
 */
export async function getStrikeCountsForUsers(
    userIds: string[],
    db: NodePgDatabase<DbSchema>,
): Promise<Map<string, number>> {
    if (userIds.length === 0) return new Map();

    const rows = await db
        .select({
            userId: schema.eventStrike.userId,
            count: sql<number>`sum(${schema.eventStrike.count})::int`,
        })
        .from(schema.eventStrike)
        .where(
            and(
                inArray(schema.eventStrike.userId, userIds),
                gte(schema.eventStrike.createdAt, getStrikeActiveCutoff()),
            ),
        )
        .groupBy(schema.eventStrike.userId);

    return new Map(rows.map((row) => [row.userId, row.count]));
}

/**
 * Issue a strike to a user for an event, idempotently. If the user already has
 * any strike tied to this event, nothing is inserted — this prevents duplicate
 * strikes from job re-runs or overlapping automatic/manual paths. Returns true
 * when a strike was created, false when one already existed.
 */
export async function issueStrike(
    db: NodePgDatabase<DbSchema>,
    input: {
        eventId: string;
        userId: string;
        count: number;
        reason: string;
    },
): Promise<boolean> {
    const existing = await db
        .select({ id: schema.eventStrike.id })
        .from(schema.eventStrike)
        .where(
            and(
                eq(schema.eventStrike.userId, input.userId),
                eq(schema.eventStrike.eventId, input.eventId),
            ),
        )
        .limit(1);

    if (existing.length > 0) {
        return false;
    }

    await db.insert(schema.eventStrike).values({
        eventId: input.eventId,
        userId: input.userId,
        count: input.count,
        reason: input.reason,
    });

    return true;
}

interface CanRegisterResult {
    allowed: boolean;
    reason?: string;
}

/**
 * Check if a user can register based on strike-based timing restrictions
 *
 * - 1 strike: must wait 3 hours after registration start
 * - 2+ strikes: must wait 12 hours after registration start
 */
export function canRegisterBasedOnStrikes(
    strikeCount: number,
    registrationStart: Date | null,
    pendingCreatedAt: Date,
): CanRegisterResult {
    if (strikeCount === 0 || !registrationStart) {
        return { allowed: true };
    }

    const hoursToWait = strikeCount === 1 ? 3 : 12;
    const registrationStartDate = new Date(registrationStart);
    const pendingCreatedAtDate = new Date(pendingCreatedAt);
    const allowedTime = new Date(
        registrationStartDate.getTime() + hoursToWait * 60 * 60 * 1000,
    );

    if (pendingCreatedAtDate < allowedTime) {
        return {
            allowed: false,
            reason: `Du har ${strikeCount} prikk${strikeCount > 1 ? "er" : ""} og må vente ${hoursToWait} timer etter påmeldingsstart før du kan melde deg på.`,
        };
    }

    return { allowed: true };
}
