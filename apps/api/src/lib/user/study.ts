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
};

/** The two group types that make up the projection, lower-cased. */
export const STUDY_GROUP_TYPES = ["study", "studyyear"] as const;

type StudyGroupRow = {
    /** Group name; the cohort's name is its year, e.g. "2023". */
    name: string;
    /** Group type. Compared case-insensitively — Lepton stored it upper-case. */
    type: string;
};

/**
 * Derive programme and cohort from a member's groups.
 *
 * Pure, so callers that already hold the memberships do not pay for a second
 * query. Several cohorts can linger on one account — a bachelor who continued
 * into a master, or a member who transferred between programmes — and the most
 * recent one is the useful one, since it is what the class year is computed
 * from.
 */
export function deriveStudyFromGroups(groups: StudyGroupRow[]): UserStudy {
    let studyProgram: string | null = null;
    let studyStartYear: number | null = null;

    for (const group of groups) {
        const type = group.type.toLowerCase();

        if (type === "study") {
            studyProgram ??= group.name;
            continue;
        }

        if (type !== "studyyear") continue;

        const year = Number.parseInt(group.name, 10);
        if (
            Number.isFinite(year) &&
            (studyStartYear === null || year > studyStartYear)
        ) {
            studyStartYear = year;
        }
    }

    return { studyProgram, studyStartYear };
}

/**
 * Look up a single member's programme and cohort.
 *
 * For callers that do not already have the memberships loaded. Prefer
 * {@link deriveStudyFromGroups} when they do.
 */
export async function getUserStudy(
    ctx: AppContext,
    userId: string,
): Promise<UserStudy> {
    const rows = await ctx.db
        .select({
            name: schema.group.name,
            type: schema.group.type,
        })
        .from(schema.groupMembership)
        .innerJoin(
            schema.group,
            eq(schema.group.slug, schema.groupMembership.groupSlug),
        )
        .where(
            and(
                eq(schema.groupMembership.userId, userId),
                inArray(sql`lower(${schema.group.type})`, [
                    ...STUDY_GROUP_TYPES,
                ]),
            ),
        );

    return deriveStudyFromGroups(rows);
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
