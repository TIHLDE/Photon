import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { DbSchema } from "~/db";

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

    // Find the first non-prioritized user
    for (const reg of registered) {
        const [userGroupSlugs, strikeCount] = await Promise.all([
            getUserGroupSlugs(reg.userId, db),
            getUserStrikeCount(reg.userId, db),
        ]);

        const isPrioritized = isUserPrioritized({
            userGroupSlugs,
            eventPools,
            strikeCount,
            enforcesPreviousStrikes,
        });

        if (!isPrioritized) {
            return reg;
        }
    }

    return null; // All registered users are prioritized
}

async function getUserStrikeCount(
    userId: string,
    db: NodePgDatabase<DbSchema>,
): Promise<number> {
    const { getUserStrikeCount: getStrikes } = await import("./strikes");
    return getStrikes(userId, db);
}

/**
 * Calculate the waitlist position for a user
 *
 * Prioritized users are ordered before non-prioritized users.
 * Within each group, users are ordered by createdAt (FIFO).
 */
export async function calculateWaitlistPosition(
    userId: string,
    eventId: string,
    eventPools: EventPool[],
    enforcesPreviousStrikes: boolean,
    db: NodePgDatabase<DbSchema>,
): Promise<number> {
    // Get all waitlisted registrations for this event
    const waitlisted = await db.query.eventRegistration.findMany({
        where: (reg, { and, eq }) =>
            and(eq(reg.eventId, eventId), eq(reg.status, "waitlisted")),
        orderBy: (reg, { asc }) => asc(reg.createdAt),
    });

    // Categorize into prioritized and non-prioritized
    const prioritizedList: Registration[] = [];
    const nonPrioritizedList: Registration[] = [];

    for (const reg of waitlisted) {
        const [userGroupSlugs, strikeCount] = await Promise.all([
            getUserGroupSlugs(reg.userId, db),
            getUserStrikeCount(reg.userId, db),
        ]);

        const isPrioritized = isUserPrioritized({
            userGroupSlugs,
            eventPools,
            strikeCount,
            enforcesPreviousStrikes,
        });

        if (isPrioritized) {
            prioritizedList.push(reg);
        } else {
            nonPrioritizedList.push(reg);
        }
    }

    // Find the user in the appropriate list
    const prioritizedIndex = prioritizedList.findIndex(
        (r) => r.userId === userId,
    );
    if (prioritizedIndex !== -1) {
        return prioritizedIndex + 1;
    }

    const nonPrioritizedIndex = nonPrioritizedList.findIndex(
        (r) => r.userId === userId,
    );
    if (nonPrioritizedIndex !== -1) {
        return prioritizedList.length + nonPrioritizedIndex + 1;
    }

    throw new Error(
        `User ${userId} not found in waitlist for event ${eventId}`,
    );
}
