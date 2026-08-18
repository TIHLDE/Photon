import {
    MASTER_CLASS_OFFSET,
    MAX_CLASS_YEAR,
    MIN_CLASS_YEAR,
    computeClassYear,
    isMasterStudySlug,
} from "@photon/auth/academic-year";
import type { DbSchema } from "@photon/db";
import { schema } from "@photon/db";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
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

/** A member's group membership, as far as prioritization cares. */
type MembershipRow = {
    slug: string;
    /** Group name. A cohort group's name is its year, e.g. "2023". */
    name: string;
    /** Free-text and upper-case from Lepton — always compare case-insensitively. */
    type: string;
};

/** What a member is, reduced to the two things a priority pool can ask about. */
export type UserPriorityFacts = {
    groupSlugs: Set<string>;
    /** 1-5, or null when we cannot place the member on a class level. */
    classYear: number | null;
};

/**
 * Which class level a member is on, from their group memberships.
 *
 * Derived from the `STUDYYEAR`/`STUDY` groups rather than
 * `studyProgramMembership`, for the reason spelled out on {@link UserStudy} in
 * `~/lib/user/study`: the table only gets rows from a Feide login, so a
 * handful of members have one while almost everyone carries the groups from
 * the Lepton migration. Reading the table here would leave the overwhelming
 * majority with no class level at all.
 *
 * Masters are the awkward case. TIHLDE counts the master's first year as 4.
 * klasse, but the cohort group only ever holds a start year — and which start
 * year it is depends on whether Feide handed out a `fc:fs:kull` for the master
 * itself. Rather than guess, we compute both readings and keep the one that
 * lands in the master's own range; a member on a master can only be on 4. or
 * 5. klasse, so at most one of the two can be right.
 *
 * Anything outside 1-5 is an alumnus and returns null — they match no class
 * pool, which is the whole point of the range.
 */
export function computeUserClassYear(
    groups: readonly MembershipRow[],
    now = new Date(),
): number | null {
    let startYear: number | null = null;
    let onMaster = false;

    for (const group of groups) {
        const type = group.type.toLowerCase();

        if (type === "study") {
            onMaster ||= isMasterStudySlug(group.slug);
            continue;
        }

        if (type !== "studyyear") continue;

        // Several cohorts linger on one account — a bachelor who continued
        // into a master, or someone who transferred — and the newest is the
        // one the class level follows.
        const year = Number.parseInt(group.name, 10);
        if (Number.isFinite(year) && (startYear === null || year > startYear)) {
            startYear = year;
        }
    }

    if (startYear === null) return null;

    const base = computeClassYear(startYear, now);
    const candidates = onMaster ? [base + MASTER_CLASS_OFFSET, base] : [base];

    for (const candidate of candidates) {
        const floor = onMaster ? MASTER_CLASS_OFFSET + 1 : MIN_CLASS_YEAR;
        if (candidate >= floor && candidate <= MAX_CLASS_YEAR) {
            return candidate;
        }
    }

    return null;
}

/**
 * Load everything prioritization needs to know about one member.
 *
 * Prefer {@link loadPrioritization} for more than one member — this issues its
 * own query.
 */
export async function getUserPriorityFacts(
    userId: string,
    db: NodePgDatabase<DbSchema>,
    now = new Date(),
): Promise<UserPriorityFacts> {
    const rows = await db
        .select({
            slug: schema.group.slug,
            name: schema.group.name,
            type: schema.group.type,
        })
        .from(schema.groupMembership)
        .innerJoin(
            schema.group,
            eq(schema.group.slug, schema.groupMembership.groupSlug),
        )
        .where(eq(schema.groupMembership.userId, userId));

    return {
        groupSlugs: new Set(rows.map((row) => row.slug)),
        classYear: computeUserClassYear(rows, now),
    };
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
    /**
     * One criterion each: at most one group and at most one class level.
     * Both null is rejected by a CHECK constraint, by Zod and by the editor.
     */
    pools: Array<{ groupSlug: string | null; classYear: number | null }>;
    priorityUsers: Array<{ userId: string }>;
}

interface IsUserPrioritizedParams {
    userGroupSlugs: Set<string>;
    /** Null when the member has no cohort — matches no class-level pool. */
    userClassYear: number | null;
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
 * - Satisfy every criterion of AT LEAST ONE priority pool
 * - and have fewer than 3 strikes (if enforcesPreviousStrikes is true)
 *
 * The strike rule applies to named individuals too. Being singled out says
 * the organizer wants you ahead of the queue, not that prikkene dine er
 * strøket — and an event that enforces strikes would otherwise have a way to
 * quietly not enforce them.
 */
export function isUserPrioritized({
    userGroupSlugs,
    userClassYear,
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

    for (const pool of event.pools) {
        // An empty pool asks nothing and would otherwise match everyone.
        if (pool.groupSlug === null && pool.classYear === null) continue;

        if (pool.groupSlug !== null && !userGroupSlugs.has(pool.groupSlug)) {
            continue;
        }

        if (pool.classYear !== null && userClassYear !== pool.classYear) {
            continue;
        }

        return true;
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
    now = new Date(),
): Promise<PrioritizationLookup> {
    const ids = [...new Set(userIds)];

    if (ids.length === 0) {
        return () => false;
    }

    const [memberships, strikes] = await Promise.all([
        // Joined to `group` so the same pass yields both the slugs a pool can
        // name and the name/type the class level is derived from — a separate
        // query per member is what this function exists to avoid.
        db
            .select({
                userId: schema.groupMembership.userId,
                slug: schema.group.slug,
                name: schema.group.name,
                type: schema.group.type,
            })
            .from(schema.groupMembership)
            .innerJoin(
                schema.group,
                eq(schema.group.slug, schema.groupMembership.groupSlug),
            )
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

    const rowsByUser = new Map<string, MembershipRow[]>();
    for (const membership of memberships) {
        const rows = rowsByUser.get(membership.userId) ?? [];
        rows.push(membership);
        rowsByUser.set(membership.userId, rows);
    }

    const factsByUser = new Map<string, UserPriorityFacts>();
    for (const [userId, rows] of rowsByUser) {
        factsByUser.set(userId, {
            groupSlugs: new Set(rows.map((row) => row.slug)),
            classYear: computeUserClassYear(rows, now),
        });
    }

    const strikesByUser = new Map<string, number>(
        strikes.map((row) => [row.userId, Number(row.total)]),
    );

    const namedIndividually = new Set(
        event.priorityUsers.map((entry) => entry.userId),
    );

    return (userId: string) => {
        const facts = factsByUser.get(userId);

        return isUserPrioritized({
            userGroupSlugs: facts?.groupSlugs ?? new Set<string>(),
            userClassYear: facts?.classYear ?? null,
            event,
            strikeCount: strikesByUser.get(userId) ?? 0,
            enforcesPreviousStrikes,
            isNamedIndividually: namedIndividually.has(userId),
        });
    };
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
    now = new Date(),
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
        now,
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
    now = new Date(),
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
        now,
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
    now = new Date(),
): Promise<number> {
    const positions = await calculateWaitlistPositions(
        eventId,
        event,
        enforcesPreviousStrikes,
        db,
        now,
    );

    const position = positions.get(userId);

    if (position === undefined) {
        throw new Error(
            `User ${userId} not found in waitlist for event ${eventId}`,
        );
    }

    return position;
}
