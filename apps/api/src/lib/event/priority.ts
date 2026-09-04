import {
    MASTER_CLASS_OFFSET,
    MAX_CLASS_YEAR,
    MIN_CLASS_YEAR,
    computeClassYear,
    isMasterStudySlug,
    programmeLength,
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
    /** Whether the slug matches a row in `study_program`. */
    isStudyProgramme?: boolean;
    /** Whether that programme is one of the five-year masters. */
    isMaster?: boolean;
    /** The member's own start year on that programme, when we have one. */
    startYear?: number | null;
    /** Whether Feide reported the programme active at the last login. */
    feideActive?: boolean | null;
};

/** What a member is, reduced to the three things a priority pool can ask about. */
export type UserPriorityFacts = {
    groupSlugs: Set<string>;
    /** 1-5, or null when we cannot place the member on a class level. */
    classYear: number | null;
    /** Study programmes the member has demonstrably moved on from. */
    supersededStudySlugs: Set<string>;
};

// Bevis i begge halvdeler, aldri én: en enslig `false` betyr like gjerne
// permisjon, utveksling eller manglende semesterregistrering, og et manglende
// flagg betyr ingenting — 1346 av 1960 studiegruppe-medlemskap i prod har
// ingen programrad bak seg.
export function findSupersededStudySlugs(
    groups: readonly MembershipRow[],
): Set<string> {
    const superseded = new Set<string>();
    let hasActiveProgramme = false;

    for (const group of groups) {
        if (group.isStudyProgramme === false) continue;
        if (group.feideActive === true) hasActiveProgramme = true;
        if (group.feideActive === false) superseded.add(group.slug);
    }

    return hasActiveProgramme ? superseded : new Set<string>();
}

/**
 * Which class level a member is on.
 *
 * Read from the member's *current* study programme, ranked exactly as
 * `deriveStudyFromGroups` ranks it, because the answer depends on which
 * programme you mean. A member who took a three-year bachelor from 2023 and
 * went on to the master in 2026 is on their fourth year of study and their
 * first of the master — the same person, two different intakes — and the only
 * way to tell them apart is to know which programme the year belongs to.
 *
 * The cohort groups are still the fallback, and carry most members: they are
 * all 1423 migrated from Lepton have. A cohort group is programme-less, so
 * when it is all we have the master ambiguity comes back, and the two-candidate
 * reading below is what resolves it.
 *
 * The ceiling is the programme's own length, not a flat five. That flat five is
 * why 398 members who finished a three-year bachelor still counted as fourth-
 * and fifth-years: nothing capped a bachelor at three, so they stayed
 * "students" for two years after graduating and would have matched any pool
 * asking for 4. or 5. klasse. `programmeLength` already encoded the right
 * answer and was already used in kvark — the frontend called them alumni while
 * the backend handed them priority.
 *
 * Anything outside the programme's range returns null: an alumnus matches no
 * class pool, which is the whole point of having a range.
 */
export function computeUserClassYear(
    groups: readonly MembershipRow[],
    now = new Date(),
): number | null {
    return computeClassStanding(groups, now).classYear;
}

/**
 * Where a member stands in their degree: the class level, and — when that is
 * null — whether we know they have finished.
 *
 * The two questions are not the same, and reading one off the other is how a
 * brand new member gets called an alumnus. `classYear` is null both for the
 * member who is past their programme and for the one we cannot place at all,
 * and in production the second group is real: accounts made in August 2026
 * that answered "Bli medlem av TIHLDE Diskgolf!" have a Feide login but no
 * study programme at all, because they study something else at NTNU.
 *
 * So `isAlumni` is only ever true on positive evidence — we know the
 * programme, we know when they started, and even the earliest reading of that
 * is past the programme's length. Without a study group we do not claim it:
 * the ceiling below collapses to 1. klasse for a member we cannot place, which
 * is a deliberate conservatism for the priority pools and no statement about
 * anyone having graduated.
 */
export type ClassStanding = {
    /** 1–5, or null when we cannot place the member on a class level. */
    classYear: number | null;
    /** Past the programme's length, on evidence rather than inference. */
    isAlumni: boolean;
};

export function computeClassStanding(
    groups: readonly MembershipRow[],
    now = new Date(),
): ClassStanding {
    let current: MembershipRow | null = null;
    let latestCohort: number | null = null;

    for (const group of groups) {
        const type = group.type.toLowerCase();

        if (type === "study") {
            if (current === null || outranksForStudy(group, current)) {
                current = group;
            }
            continue;
        }

        if (type !== "studyyear") continue;

        const year = Number.parseInt(group.name, 10);
        if (
            Number.isFinite(year) &&
            (latestCohort === null || year > latestCohort)
        ) {
            latestCohort = year;
        }
    }

    const onMaster = current
        ? Boolean(current.isMaster) || isMasterStudySlug(current.slug)
        : false;

    /**
     * The programme's own year is unambiguous — it says when *this* degree
     * started. The cohort group does not: for a master it almost always holds
     * the year their bachelor began.
     */
    const ownYear = current?.startYear ?? null;
    const startYear = ownYear ?? latestCohort;

    if (startYear === null) return { classYear: null, isAlumni: false };

    const base = computeClassYear(startYear, now);

    /**
     * With the master's own intake there is nothing to guess: year one of a
     * master is 4. klasse. Without it we compute both readings and keep the one
     * that lands in the master's range, since a master student can only be on
     * 4. or 5. klasse and at most one of the two can be right.
     */
    const candidates =
        onMaster && ownYear !== null
            ? [base + MASTER_CLASS_OFFSET]
            : onMaster
              ? [base + MASTER_CLASS_OFFSET, base]
              : [base];

    const ceiling = current
        ? programmeLength(current.slug)
        : onMaster
          ? MAX_CLASS_YEAR
          : MIN_CLASS_YEAR;

    for (const candidate of candidates) {
        const floor = onMaster ? MASTER_CLASS_OFFSET + 1 : MIN_CLASS_YEAR;
        if (candidate >= floor && candidate <= ceiling) {
            return { classYear: candidate, isAlumni: false };
        }
    }

    /**
     * Out of range, in one of two directions. Past the end is a graduate; below
     * the floor is a year we cannot make sense of — a cohort group dated next
     * autumn, say — and claiming they finished would be the wrong way round.
     * Measured against the programme's own length rather than `ceiling`, which
     * is not one for the member we could not place on a programme at all.
     */
    const finished =
        current !== null &&
        Math.min(...candidates) > programmeLength(current.slug);

    return { classYear: null, isAlumni: finished };
}

/**
 * Whether `a` is a more current study than `b`.
 *
 * Deliberately the same order as `deriveStudyFromGroups` in `~/lib/user/study`:
 * the study a member is shown as taking and the study their class level is
 * computed from must never be two different programmes.
 */
function outranksForStudy(a: MembershipRow, b: MembershipRow): boolean {
    if ((a.isStudyProgramme === false) !== (b.isStudyProgramme === false)) {
        return b.isStudyProgramme === false;
    }

    const rank = (active: boolean | null | undefined) =>
        active === true ? 2 : active === false ? 0 : 1;
    if (rank(a.feideActive) !== rank(b.feideActive)) {
        return rank(a.feideActive) > rank(b.feideActive);
    }

    const yearA = a.startYear ?? null;
    const yearB = b.startYear ?? null;
    if (yearA !== yearB) {
        if (yearA === null) return false;
        if (yearB === null) return true;
        return yearA > yearB;
    }

    const masterA = Boolean(a.isMaster) || isMasterStudySlug(a.slug);
    const masterB = Boolean(b.isMaster) || isMasterStudySlug(b.slug);
    if (masterA !== masterB) return masterA;

    return a.slug.localeCompare(b.slug) < 0;
}

/**
 * Reshape a joined row into what the class-level maths reads.
 *
 * The programme columns come from LEFT joins, so every non-study group in the
 * same pass carries nulls here — which is exactly right: they are not studies
 * and must not be ranked as one.
 */
function toMembershipRow(row: {
    slug: string;
    name: string;
    type: string;
    programmeId: number | null;
    programmeType: string | null;
    startYear: number | null;
    feideActive: boolean | null;
}): MembershipRow {
    return {
        slug: row.slug,
        name: row.name,
        type: row.type,
        isStudyProgramme: row.programmeId !== null,
        isMaster: row.programmeType === "master",
        startYear: row.startYear,
        feideActive: row.feideActive,
    };
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
            programmeId: schema.studyProgram.id,
            programmeType: schema.studyProgram.type,
            startYear: schema.studyProgramMembership.startYear,
            feideActive: schema.studyProgramMembership.feideActive,
        })
        .from(schema.groupMembership)
        .innerJoin(
            schema.group,
            eq(schema.group.slug, schema.groupMembership.groupSlug),
        )
        .leftJoin(
            schema.studyProgram,
            eq(schema.studyProgram.slug, schema.group.slug),
        )
        .leftJoin(
            schema.studyProgramMembership,
            and(
                eq(
                    schema.studyProgramMembership.userId,
                    schema.groupMembership.userId,
                ),
                eq(
                    schema.studyProgramMembership.studyProgramId,
                    schema.studyProgram.id,
                ),
            ),
        )
        .where(eq(schema.groupMembership.userId, userId));

    const membershipRows = rows.map(toMembershipRow);

    return {
        groupSlugs: new Set(rows.map((row) => row.slug)),
        classYear: computeUserClassYear(membershipRows, now),
        supersededStudySlugs: findSupersededStudySlugs(membershipRows),
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
    /** Fra {@link findSupersededStudySlugs}; tomt betyr ingen bevis. */
    supersededStudySlugs?: Set<string>;
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
 *
 * A pool naming a study programme asks about the programme the member is on
 * now; every other kind of group still asks only about membership.
 */
export function isUserPrioritized({
    userGroupSlugs,
    userClassYear,
    supersededStudySlugs,
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

        if (pool.groupSlug !== null) {
            if (!userGroupSlugs.has(pool.groupSlug)) continue;
            if (supersededStudySlugs?.has(pool.groupSlug)) continue;
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
                programmeId: schema.studyProgram.id,
                programmeType: schema.studyProgram.type,
                startYear: schema.studyProgramMembership.startYear,
                feideActive: schema.studyProgramMembership.feideActive,
            })
            .from(schema.groupMembership)
            .innerJoin(
                schema.group,
                eq(schema.group.slug, schema.groupMembership.groupSlug),
            )
            .leftJoin(
                schema.studyProgram,
                eq(schema.studyProgram.slug, schema.group.slug),
            )
            .leftJoin(
                schema.studyProgramMembership,
                and(
                    eq(
                        schema.studyProgramMembership.userId,
                        schema.groupMembership.userId,
                    ),
                    eq(
                        schema.studyProgramMembership.studyProgramId,
                        schema.studyProgram.id,
                    ),
                ),
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
        rows.push(toMembershipRow(membership));
        rowsByUser.set(membership.userId, rows);
    }

    const factsByUser = new Map<string, UserPriorityFacts>();
    for (const [userId, rows] of rowsByUser) {
        factsByUser.set(userId, {
            groupSlugs: new Set(rows.map((row) => row.slug)),
            classYear: computeUserClassYear(rows, now),
            supersededStudySlugs: findSupersededStudySlugs(rows),
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
            supersededStudySlugs: facts?.supersededStudySlugs,
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
