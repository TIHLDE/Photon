import { type DbSchema, schema } from "@photon/db";
import { and, eq, isNotNull } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

/**
 * The institutes a user belongs to, read from the study groups they are a
 * member of.
 *
 * Study group membership is the right source here rather than
 * `studyProgramMembership`: the latter only gets rows from a Feide login,
 * while every member — including everyone migrated from Lepton — has the
 * study group. Group membership is additive and never revoked, which is
 * deliberate: a member who has finished DigSec keeps counting as IIK.
 *
 * Someone can legitimately land in more than one institute (a bachelor at
 * IDI followed by a master at IIK), so this returns a set, and belonging to
 * the restricted institute is enough.
 */
export async function getUserInstituteIds(
    userId: string,
    db: NodePgDatabase<DbSchema>,
): Promise<Set<number>> {
    const rows = await db
        .select({ instituteId: schema.group.instituteId })
        .from(schema.groupMembership)
        .innerJoin(
            schema.group,
            eq(schema.group.slug, schema.groupMembership.groupSlug),
        )
        .where(
            and(
                eq(schema.groupMembership.userId, userId),
                isNotNull(schema.group.instituteId),
            ),
        );

    return new Set(
        rows
            .map((row) => row.instituteId)
            .filter((id): id is number => id !== null),
    );
}

/**
 * Whether a user may register for an event restricted to a single institute.
 *
 * An unrestricted event (`restrictedToInstituteId` is null) is open to
 * everyone. A restricted one admits only members of that institute — a user
 * with no institute at all is turned away, since "we don't know" must not
 * read as "let them in".
 */
export function isUserInInstitute(
    restrictedToInstituteId: number | null,
    userInstituteIds: Set<number>,
): boolean {
    if (restrictedToInstituteId === null) return true;
    return userInstituteIds.has(restrictedToInstituteId);
}
