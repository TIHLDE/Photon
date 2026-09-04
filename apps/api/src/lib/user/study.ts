import { isFeideCheckCurrent } from "@photon/auth/feide";
import { schema } from "@photon/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { AppContext } from "~/lib/ctx";

/**
 * A member's study programme and cohort, as read from their group memberships.
 *
 * TIHLDE models studies twice: as `studyProgramMembership`, fed by Feide, and
 * as `STUDY`/`STUDYYEAR` group memberships. The groups are the source every
 * read should use — the table only gets rows from a Feide login, so of 1707
 * members in production just 8 have one, while 1667 carry both groups from the
 * Lepton migration. Reading the table instead is how the application PDF ended
 * up signing almost everyone with a bare username.
 */
export type UserStudy = {
    studyProgram: string | null;
    studyStartYear: number | null;
    /** How well we know the member is on that programme. */
    verification: StudyVerification;
};

/**
 * How well we know a member is on the programme we show for them.
 *
 * - `active` — Feide said they are enrolled, recently enough that a semester
 *   cannot have turned over since; see `FEIDE_CHECK_MAX_AGE_DAYS`.
 * - `inactive` — Feide said they are *not* enrolled, just as recently. The one
 *   state here that is knowledge rather than the absence of it, and the reason
 *   this is four values and not three: it used to share `verified` with
 *   `active`, so a member Feide had confirmed as finished read exactly like a
 *   member Feide had confirmed as studying.
 * - `stale` — Feide answered once, but long enough ago that the member may
 *   have finished or switched without us hearing about it.
 * - `unverified` — Feide has never answered for this programme. Most of the
 *   organization: the study group came from the Lepton migration, from the
 *   fadderuka sign-up form, or from an admin correction, and none of those is
 *   evidence of enrolment.
 *
 * Only ever used to *inform*, including `inactive`. A priority pool still
 * matches on group membership whatever this says, and nobody is turned away
 * from an event on it — see `findSupersededStudySlugs` in
 * `~/lib/event/priority` for the one reading that is evidence enough to act
 * on by itself.
 */
export type StudyVerification = "active" | "inactive" | "stale" | "unverified";

/** The two group types that make up the projection, lower-cased. */
export const STUDY_GROUP_TYPES = ["study", "studyyear"] as const;

export type StudyGroupRow = {
    /** Group slug. A cohort group's slug is its year, e.g. "2023". */
    slug: string;
    /** Group name; the cohort's name is its year too. */
    name: string;
    /** Group type. Compared case-insensitively — Lepton stored it upper-case. */
    type: string;
    /**
     * Whether this slug matches a row in `study_program`.
     *
     * `type = 'STUDY'` is not proof of a study: `fondsforvalter` carries that
     * type in production without being one, and would otherwise read as
     * someone's degree. Callers join `study_program` and pass the result here;
     * a group without one sorts last rather than disappearing. See
     * https://github.com/TIHLDE/Photon/issues/621.
     */
    isStudyProgramme?: boolean;
    /** Whether the programme is one of the five-year masters. */
    isMaster?: boolean;
    /** `studyProgramMembership.startYear`, when the caller loaded it. */
    startYear?: number | null;
    /** `studyProgramMembership.feideActive`, when the caller loaded it. */
    feideActive?: boolean | null;
    /** `studyProgramMembership.feideCheckedAt`, when the caller loaded it. */
    feideCheckedAt?: Date | null;
};

/**
 * How sure we are that a member is enrolled on a programme *right now*.
 *
 * `true` is Feide saying so at the last login. `null` is no answer — the
 * member has not logged in with Feide since the Lepton migration, which is
 * most of them. `false` is Feide saying no, which is the only one of the three
 * that is evidence against, so it sorts below "we have no idea".
 */
function enrolmentRank(feideActive: boolean | null | undefined): number {
    if (feideActive === true) return 2;
    if (feideActive === false) return 0;
    return 1;
}

/**
 * Derive programme and cohort from a member's groups.
 *
 * Pure, so callers that already hold the memberships do not pay for a second
 * query.
 *
 * A member can hold several study groups — the groups are additive on purpose,
 * so they accumulate everything someone has ever studied — and this used to
 * take whichever came back first. That is the bug the whole change exists for:
 * Postgres returns rows in whatever order it likes, so a member who had
 * switched programmes was shown an arbitrary one of them, and for the member
 * who reported it that meant his old bachelor rather than the master he had
 * started.
 *
 * The order, most-current first:
 *
 * 1. **Feide says enrolled**, the only signal that means "now".
 * 2. **The later start year**, which is what separates a master begun in 2026
 *    from the bachelor it followed. Unknown years sort last, never first.
 * 3. **Master before bachelor**, then **slug** — neither decides a real case,
 *    but together they mean no caller can ever depend on Postgres's ordering
 *    again.
 *
 * The cohort year follows the programme that wins, falling back to the highest
 * cohort group when we have no year for it. That fallback carries the 1423
 * members who have groups but no programme row at all.
 */
export function deriveStudyFromGroups(
    groups: StudyGroupRow[],
    now: Date = new Date(),
): UserStudy {
    let chosen: StudyGroupRow | null = null;
    let latestCohort: number | null = null;

    for (const group of groups) {
        const type = group.type.toLowerCase();

        if (type === "study") {
            if (chosen === null || outranks(group, chosen)) chosen = group;
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

    /**
     * Read off the programme that won, not off the member as a whole: the
     * question is whether *this* programme is confirmed, and a fresh answer
     * about the master someone has moved on to says nothing about the bachelor
     * we would be showing if it had lost the ranking.
     */
    const verification: StudyVerification =
        chosen?.feideActive == null
            ? "unverified"
            : !isFeideCheckCurrent(chosen.feideCheckedAt, now)
              ? "stale"
              : chosen.feideActive
                ? "active"
                : "inactive";

    return {
        studyProgram: chosen?.name ?? null,
        studyStartYear: chosen?.startYear ?? latestCohort,
        verification,
    };
}

/** Whether `a` is a more current programme than `b`; see the order above. */
function outranks(a: StudyGroupRow, b: StudyGroupRow): boolean {
    /**
     * A group that matches a real study programme beats one that does not.
     * Ranked rather than filtered out: `fondsforvalter` must never win over
     * someone's actual degree, but a curated study group added before its
     * `study_program` row exists should still show up rather than leaving the
     * member with no study at all.
     */
    if ((a.isStudyProgramme === false) !== (b.isStudyProgramme === false)) {
        return b.isStudyProgramme === false;
    }

    const rankA = enrolmentRank(a.feideActive);
    const rankB = enrolmentRank(b.feideActive);
    if (rankA !== rankB) return rankA > rankB;

    const yearA = a.startYear ?? null;
    const yearB = b.startYear ?? null;
    if (yearA !== yearB) {
        if (yearA === null) return false;
        if (yearB === null) return true;
        return yearA > yearB;
    }

    if (Boolean(a.isMaster) !== Boolean(b.isMaster)) return Boolean(a.isMaster);

    return a.slug.localeCompare(b.slug) < 0;
}

/**
 * The study and cohort groups of a set of members, with everything
 * {@link deriveStudyFromGroups} needs to rank them.
 *
 * One query for the whole page or export rather than one per member, so the
 * ordering stays the shared one instead of each endpoint growing its own. The
 * join to `study_program` is a LEFT join on purpose: cohort groups have no
 * programme, and an inner join would drop them along with the cohort year.
 */
export async function loadStudyGroupRows(
    ctx: AppContext,
    userIds: string[],
): Promise<Map<string, StudyGroupRow[]>> {
    const byUser = new Map<string, StudyGroupRow[]>();
    if (userIds.length === 0) return byUser;

    const rows = await ctx.db
        .select({
            userId: schema.groupMembership.userId,
            slug: schema.group.slug,
            name: schema.group.name,
            type: schema.group.type,
            programmeId: schema.studyProgram.id,
            programmeType: schema.studyProgram.type,
            startYear: schema.studyProgramMembership.startYear,
            feideActive: schema.studyProgramMembership.feideActive,
            feideCheckedAt: schema.studyProgramMembership.feideCheckedAt,
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
        .where(
            and(
                inArray(schema.groupMembership.userId, userIds),
                inArray(sql`lower(${schema.group.type})`, [
                    ...STUDY_GROUP_TYPES,
                ]),
            ),
        );

    for (const row of rows) {
        const entry = byUser.get(row.userId) ?? [];
        entry.push({
            slug: row.slug,
            name: row.name,
            type: row.type,
            isStudyProgramme: row.programmeId !== null,
            isMaster: row.programmeType === "master",
            startYear: row.startYear,
            feideActive: row.feideActive,
            feideCheckedAt: row.feideCheckedAt,
        });
        byUser.set(row.userId, entry);
    }

    return byUser;
}

/**
 * Look up a single member's programme and cohort.
 *
 * For callers that do not already have the memberships loaded. Prefer
 * {@link loadStudyGroupRows} for more than one member.
 */
export async function getUserStudy(
    ctx: AppContext,
    userId: string,
): Promise<UserStudy> {
    const byUser = await loadStudyGroupRows(ctx, [userId]);
    return deriveStudyFromGroups(byUser.get(userId) ?? []);
}

/**
 * Whether Feide currently reports the member as an enrolled student.
 *
 * The study *groups* cannot answer this. They are additive on purpose — "én
 * gang TIHLDE-medlem, alltid TIHLDE-medlem" — so `digital-samhandling` holds
 * everyone who ever took the programme, alumni included, and its cohort years
 * are no help either: for most members the cohort group carries the year they
 * started their *bachelor*, not the master. The only field that says "enrolled
 * now" is `studyProgramMembership.feideActive`, written from
 * `membership.active` on every Feide login.
 *
 * @param programSlug Programme to ask about, by slug — study programmes and
 *   their groups share one, a convention the seed establishes. Pass `null` to
 *   ask the weaker question "is this person still a student at all", which is
 *   the most a cohort group can meaningfully be gated on.
 *
 * Returns false when we have never had an answer. A NULL `feideActive` means
 * the member has not logged in with Feide since the Lepton migration, so we
 * have no evidence either way — and a caller that reaches for this function
 * wants positive proof of enrolment, not the benefit of the doubt.
 */
export async function hasActiveStudyProgram(
    ctx: AppContext,
    userId: string,
    programSlug: string | null,
): Promise<boolean> {
    const rows = await ctx.db
        .select({ userId: schema.studyProgramMembership.userId })
        .from(schema.studyProgramMembership)
        .innerJoin(
            schema.studyProgram,
            eq(
                schema.studyProgram.id,
                schema.studyProgramMembership.studyProgramId,
            ),
        )
        .where(
            and(
                eq(schema.studyProgramMembership.userId, userId),
                eq(schema.studyProgramMembership.feideActive, true),
                programSlug === null
                    ? undefined
                    : eq(schema.studyProgram.slug, programSlug),
            ),
        )
        .limit(1);

    return rows.length > 0;
}

/**
 * One study programme a member belongs to, with everything the ordering below
 * needs to rank it.
 */
export type MemberStudyProgram = {
    id: number;
    slug: string;
    displayName: string;
    isMaster: boolean;
    startYear: number | null;
    /** Whether Feide reported this programme as active at the last login. */
    feideActive: boolean;
};

/**
 * Every study programme a member has any tie to, most-current first.
 *
 * "Current" cannot be read off a single column. The study *groups* are additive
 * on purpose — "én gang TIHLDE-medlem, alltid TIHLDE-medlem" — so they hold
 * everything a member has ever studied, and the programme table only gets rows
 * from a Feide login, so in production just 502 of 1925 members have one at
 * all. Either source alone answers the wrong question for most people.
 *
 * So both are read, and the ordering decides:
 *
 * 1. **`feideActive`**, which is the only field that means "enrolled now".
 * 2. **The later start year**, which separates a master begun in 2026 from the
 *    bachelor it followed. Rows without a year sort last — never first, or a
 *    programme we know nothing about would outrank one we do.
 * 3. **Master before bachelor**, then **slug**. Neither will decide a real case;
 *    they are here so no caller ever depends on the order Postgres happened to
 *    return rows in. That arbitrary order is the original bug: members who had
 *    switched programmes were shown whichever study came back first.
 *
 * Note the join to `study_program`. Filtering on `group.type = 'STUDY'` alone is
 * not enough — the group `fondsforvalter` carries that type in production
 * without being a study at all, and would otherwise read as someone's degree.
 * See https://github.com/TIHLDE/Photon/issues/621.
 */
export async function listMemberStudyPrograms(
    ctx: AppContext,
    userId: string,
): Promise<MemberStudyProgram[]> {
    const rows = await ctx.db
        .select({
            id: schema.studyProgram.id,
            slug: schema.studyProgram.slug,
            displayName: schema.studyProgram.displayName,
            type: schema.studyProgram.type,
            startYear: schema.studyProgramMembership.startYear,
            feideActive: schema.studyProgramMembership.feideActive,
            groupSlug: schema.groupMembership.groupSlug,
        })
        .from(schema.studyProgram)
        .leftJoin(
            schema.studyProgramMembership,
            and(
                eq(
                    schema.studyProgramMembership.studyProgramId,
                    schema.studyProgram.id,
                ),
                eq(schema.studyProgramMembership.userId, userId),
            ),
        )
        .leftJoin(
            schema.groupMembership,
            and(
                eq(schema.groupMembership.groupSlug, schema.studyProgram.slug),
                eq(schema.groupMembership.userId, userId),
            ),
        );

    return rows
        .filter(
            (row) =>
                row.groupSlug !== null ||
                row.feideActive !== null ||
                row.startYear !== null,
        )
        .map((row) => ({
            id: row.id,
            slug: row.slug,
            displayName: row.displayName,
            isMaster: row.type === "master",
            startYear: row.startYear,
            feideActive: row.feideActive === true,
        }))
        .sort((a, b) => {
            if (a.feideActive !== b.feideActive) return a.feideActive ? -1 : 1;
            if (a.startYear !== b.startYear) {
                if (a.startYear === null) return 1;
                if (b.startYear === null) return -1;
                return b.startYear - a.startYear;
            }
            if (a.isMaster !== b.isMaster) return a.isMaster ? -1 : 1;
            return a.slug.localeCompare(b.slug);
        });
}

/**
 * The programme a member is on *now*, or null when we have no tie to any.
 *
 * Thin wrapper over {@link listMemberStudyPrograms} so callers that want the
 * single answer do not re-implement the ordering — which is the whole point of
 * having it in one place.
 */
export async function getCurrentStudyProgram(
    ctx: AppContext,
    userId: string,
): Promise<MemberStudyProgram | null> {
    const [current] = await listMemberStudyPrograms(ctx, userId);
    return current ?? null;
}
