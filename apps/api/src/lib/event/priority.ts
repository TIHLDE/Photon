import type { DbSchema } from "@photon/db";
import { schema } from "@photon/db";
import { and, gte, inArray, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { getStrikeActiveCutoff } from "./strikes";

/**
 * Get all group slugs that a user belongs to
 */
export async function getUserGroupSlugs(
    userId: string,
    db: NodePgDatabase<DbSchema>,
): Promise<Set<string>> {
    const memberships = await db.query.groupMembership.findMany({
        where: (membership, { eq }) => eq(membership.userId, userId),
        columns: {
            groupSlug: true,
        },
    });

    return new Set(memberships.map((m) => m.groupSlug));
}

interface EventPool {
    groups: Array<{ groupSlug: string }>;
}

interface IsUserPrioritizedParams {
    userGroupSlugs: Set<string>;
    eventPools: EventPool[];
    strikeCount: number;
    enforcesPreviousStrikes: boolean;
}

/**
 * Determine if a user is prioritized for an event
 *
 * A user is prioritized if they:
 * - Belong to ALL groups in AT LEAST ONE priority pool
 * - Have fewer than 3 strikes (if enforcesPreviousStrikes is true)
 */
export function isUserPrioritized({
    userGroupSlugs,
    eventPools,
    strikeCount,
    enforcesPreviousStrikes,
}: IsUserPrioritizedParams): boolean {
    // Users with 3+ strikes cannot be prioritized
    if (enforcesPreviousStrikes && strikeCount >= 3) {
        return false;
    }

    // Check if user matches any priority pool
    for (const pool of eventPools) {
        const poolGroupSlugs = pool.groups.map((g) => g.groupSlug);

        // User must belong to ALL groups in the pool
        const hasAllGroups = poolGroupSlugs.every((slug) =>
            userGroupSlugs.has(slug),
        );

        if (hasAllGroups && poolGroupSlugs.length > 0) {
            return true;
        }
    }

    return false;
}

/**
 * Answers "is this user prioritized for this event" without touching the
 * database — every membership and strike it needs was fetched up front.
 */
export type PrioritizationLookup = (userId: string) => boolean;

/**
 * Fetch everything needed to prioritize a whole group of users, in two
 * queries, and hand back a lookup over the result.
 *
 * Deciding this one user at a time is what made the waitlist O(n²): the
 * position of every waitlisted member was recomputed by walking the entire
 * waitlist, and each step asked the database for that member's groups and
 * strikes. A 200-person waitlist meant tens of thousands of queries inside a
 * transaction holding `FOR UPDATE` locks.
 */
export async function loadPrioritization(
    userIds: string[],
    eventPools: EventPool[],
    enforcesPreviousStrikes: boolean,
    db: NodePgDatabase<DbSchema>,
): Promise<PrioritizationLookup> {
    const ids = [...new Set(userIds)];

    if (ids.length === 0) {
        return () => false;
    }

    const [memberships, strikes] = await Promise.all([
        db
            .select({
                userId: schema.groupMembership.userId,
                groupSlug: schema.groupMembership.groupSlug,
            })
            .from(schema.groupMembership)
            .where(inArray(schema.groupMembership.userId, ids)),
        db
            .select({
                userId: schema.eventStrike.userId,
                // Sum, not count: a single strike row can be worth several,
                // exactly as {@link getUserStrikeCount} treats it.
                total: sql<number>`coalesce(sum(${schema.eventStrike.count}), 0)::int`,
            })
            .from(schema.eventStrike)
            .where(
                and(
                    inArray(schema.eventStrike.userId, ids),
                    gte(schema.eventStrike.createdAt, getStrikeActiveCutoff()),
                ),
            )
            .groupBy(schema.eventStrike.userId),
    ]);

    const groupsByUser = new Map<string, Set<string>>();
    for (const membership of memberships) {
        const slugs = groupsByUser.get(membership.userId) ?? new Set<string>();
        slugs.add(membership.groupSlug);
        groupsByUser.set(membership.userId, slugs);
    }

    const strikesByUser = new Map<string, number>(
        strikes.map((row) => [row.userId, Number(row.total)]),
    );

    return (userId: string) =>
        isUserPrioritized({
            userGroupSlugs: groupsByUser.get(userId) ?? new Set<string>(),
            eventPools,
            strikeCount: strikesByUser.get(userId) ?? 0,
            enforcesPreviousStrikes,
        });
}

interface Registration {
    userId: string;
    eventId: string;
    status: string;
    createdAt: Date;
}

/**
 * Find a non-prioritized user who can be swapped with a prioritized user
 *
 * Returns the most recently registered non-prioritized user with a spot,
 * or null if all registered users are prioritized.
 */
export async function findSwapTarget(
    registeredUsers: Registration[],
    eventPools: EventPool[],
    enforcesPreviousStrikes: boolean,
    db: NodePgDatabase<DbSchema>,
): Promise<Registration | null> {
    // Filter to only registered users and sort by createdAt DESC (most recent first)
    const registered = registeredUsers
        .filter((r) => r.status === "registered")
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const isPrioritized = await loadPrioritization(
        registered.map((r) => r.userId),
        eventPools,
        enforcesPreviousStrikes,
        db,
    );

    // Find the first non-prioritized user
    for (const reg of registered) {
        if (!isPrioritized(reg.userId)) {
            return reg;
        }
    }

    return null; // All registered users are prioritized
}

/**
 * Work out where everyone on the waitlist stands, in one pass.
 *
 * Prioritized users are ordered before non-prioritized users. Within each
 * group, users are ordered by createdAt (FIFO).
 */
export async function calculateWaitlistPositions(
    eventId: string,
    eventPools: EventPool[],
    enforcesPreviousStrikes: boolean,
    db: NodePgDatabase<DbSchema>,
): Promise<Map<string, number>> {
    const waitlisted = await db.query.eventRegistration.findMany({
        where: (reg, { and, eq }) =>
            and(eq(reg.eventId, eventId), eq(reg.status, "waitlisted")),
        orderBy: (reg, { asc }) => asc(reg.createdAt),
    });

    const isPrioritized = await loadPrioritization(
        waitlisted.map((reg) => reg.userId),
        eventPools,
        enforcesPreviousStrikes,
        db,
    );

    const prioritized: string[] = [];
    const nonPrioritized: string[] = [];

    for (const reg of waitlisted) {
        if (isPrioritized(reg.userId)) {
            prioritized.push(reg.userId);
        } else {
            nonPrioritized.push(reg.userId);
        }
    }

    return new Map(
        [...prioritized, ...nonPrioritized].map((userId, index) => [
            userId,
            index + 1,
        ]),
    );
}

/**
 * Calculate the waitlist position for a single user.
 *
 * Prefer {@link calculateWaitlistPositions} when more than one position is
 * needed — this one recomputes the whole waitlist to answer for one member.
 */
export async function calculateWaitlistPosition(
    userId: string,
    eventId: string,
    eventPools: EventPool[],
    enforcesPreviousStrikes: boolean,
    db: NodePgDatabase<DbSchema>,
): Promise<number> {
    const positions = await calculateWaitlistPositions(
        eventId,
        eventPools,
        enforcesPreviousStrikes,
        db,
    );

    const position = positions.get(userId);

    if (position === undefined) {
        throw new Error(
            `User ${userId} not found in waitlist for event ${eventId}`,
        );
    }

    return position;
}
