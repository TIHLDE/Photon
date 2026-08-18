import type { DbSchema } from "@photon/db";
import { schema } from "@photon/db";
import { and, gte, inArray, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { HTTPException } from "hono/http-exception";
import { getStrikeActiveCutoff } from "./strikes";

/**
 * De unike id-ene i lista over navngitte prioriterte, etter at det er
 * kontrollert at brukerne finnes.
 *
 * Uten sjekken slår en id som ikke finnes ut som en fremmednøkkelfeil midt i
 * transaksjonen — 500, med spørringen i svaret. Det er ikke et teoretisk
 * tilfelle: arrangøren søker opp noen, brukeren slettes, og lagringen skjer
 * etterpå. Samme mønster som kontaktpersonen valideres med.
 *
 * Duplikater fjernes her, ikke i rutene: den sammensatte primærnøkkelen ville
 * ellers avvist hele arrangementet fordi noen sto to ganger i lista.
 */
export async function resolvePriorityUserIds(
    userIds: string[],
    db: NodePgDatabase<DbSchema>,
): Promise<string[]> {
    const ids = [...new Set(userIds)];

    if (ids.length === 0) {
        return [];
    }

    const found = await db
        .select({ id: schema.user.id })
        .from(schema.user)
        .where(inArray(schema.user.id, ids));

    const foundIds = new Set(found.map((row) => row.id));
    const missing = ids.filter((id) => !foundIds.has(id));

    if (missing.length > 0) {
        throw new HTTPException(400, {
            message: `User with ID "${missing[0]}" does not exist`,
        });
    }

    return ids;
}

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

/**
 * The two ways an event grants priority, in the shape the loaded event row
 * already has: pools of groups, and named individuals.
 *
 * Passed as one object rather than two parameters so a caller cannot load the
 * event without its `priorityUsers` and still typecheck — forgetting it would
 * silently drop everyone the organizer named by hand.
 */
export interface EventPriorityRules {
    pools: EventPool[];
    priorityUsers: Array<{ userId: string }>;
}

interface IsUserPrioritizedParams {
    userGroupSlugs: Set<string>;
    event: EventPriorityRules;
    strikeCount: number;
    enforcesPreviousStrikes: boolean;
    /**
     * Whether the event names this user directly. Kept as a flag rather than
     * a user id so the group-based path stays free of identity: this function
     * never learns who it is reasoning about.
     */
    isNamedIndividually: boolean;
}

/**
 * Determine if a user is prioritized for an event
 *
 * A user is prioritized if they:
 * - Are named individually on the event, OR
 * - Belong to ALL groups in AT LEAST ONE priority pool
 * - and have fewer than 3 strikes (if enforcesPreviousStrikes is true)
 *
 * The strike rule applies to named individuals too. Being singled out says
 * the organizer wants you ahead of the queue, not that prikkene dine er
 * strøket — and an event that enforces strikes would otherwise have a way to
 * quietly not enforce them.
 */
export function isUserPrioritized({
    userGroupSlugs,
    event,
    strikeCount,
    enforcesPreviousStrikes,
    isNamedIndividually,
}: IsUserPrioritizedParams): boolean {
    // Users with 3+ strikes cannot be prioritized
    if (enforcesPreviousStrikes && strikeCount >= 3) {
        return false;
    }

    if (isNamedIndividually) {
        return true;
    }

    // Check if user matches any priority pool
    for (const pool of event.pools) {
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
    event: EventPriorityRules,
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

    const namedIndividually = new Set(
        event.priorityUsers.map((entry) => entry.userId),
    );

    return (userId: string) =>
        isUserPrioritized({
            userGroupSlugs: groupsByUser.get(userId) ?? new Set<string>(),
            event,
            strikeCount: strikesByUser.get(userId) ?? 0,
            enforcesPreviousStrikes,
            isNamedIndividually: namedIndividually.has(userId),
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
    event: EventPriorityRules,
    enforcesPreviousStrikes: boolean,
    db: NodePgDatabase<DbSchema>,
): Promise<Registration | null> {
    // Filter to only registered users and sort by createdAt DESC (most recent first)
    const registered = registeredUsers
        .filter((r) => r.status === "registered")
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const isPrioritized = await loadPrioritization(
        registered.map((r) => r.userId),
        event,
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
    event: EventPriorityRules,
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
        event,
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
    event: EventPriorityRules,
    enforcesPreviousStrikes: boolean,
    db: NodePgDatabase<DbSchema>,
): Promise<number> {
    const positions = await calculateWaitlistPositions(
        eventId,
        event,
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
