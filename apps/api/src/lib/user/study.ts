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
