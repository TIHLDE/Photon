import { schema } from "@photon/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import {
    updateStudyYearInputSchema,
    updateStudyYearResponseSchema,
} from "../schema";

/**
 * Correct a member's cohort by hand.
 *
 * The escape hatch for the assumption in `syncFeideForUser`: NTNU issues no
 * `fc:fs:kull` for ITBAITBEDR, so an active student with no known intake is
 * assumed to be a first-year. That is right for the autumn intake and for
 * anyone transferring in, and wrong for someone further along who registers
 * for the first time — they lose priority on their own graduation ball, notice,
 * and ask us to fix it.
 *
 * Writing `manual` is the point: it outranks Feide in the sync's conflict
 * guard, so the correction survives every later login instead of being quietly
 * reverted. The three group-membership routes still refuse to touch STUDYYEAR
 * groups directly — this is the only sanctioned way in, and it keeps the
 * cohort group and the study-programme row from drifting apart.
 */
export const updateStudyYearRoute = route().patch(
    "/:id/study-year",
    describeRoute({
        tags: ["users"],
        summary: "Correct a member's cohort",
        operationId: "updateUserStudyYear",
        description:
            "Set a member's cohort start year by hand, overriding what Feide reports. Moves their STUDYYEAR group to match. Requires 'users:manage'.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: updateStudyYearResponseSchema,
            description: "Cohort updated",
        })
        .notFound({ description: "User not found" })
        .forbidden({ description: "Requires users:manage" })
        .build(),
    requireAuth,
    requireAccess({ permission: "users:manage" }),
    validator("json", updateStudyYearInputSchema),
    async (c) => {
        const { db } = c.get("ctx");
        const userId = c.req.param("id");
        const { startYear } = c.req.valid("json");

        const user = await db.query.user.findFirst({
            where: eq(schema.user.id, userId),
            columns: { id: true },
        });

        if (!user) {
            throw new HTTPException(404, {
                message: `User "${userId}" not found`,
            });
        }

        await db.transaction(async (tx) => {
            /**
             * Every programme row, not just one. A member who transferred has
             * a row per programme, and leaving one behind would let the sync
             * keep deriving the old cohort group from it on the next login.
             */
            const updated = await tx
                .update(schema.studyProgramMembership)
                .set({
                    startYear,
                    startYearSource: "manual",
                    updatedAt: new Date(),
                })
                .where(eq(schema.studyProgramMembership.userId, userId))
                .returning({
                    userId: schema.studyProgramMembership.userId,
                });

            /**
             * Members migrated from Lepton have no programme row — 1699 of
             * 1707 in production — because the table is only ever written by a
             * Feide login. Without one there is nowhere to record that the
             * cohort was set by hand, and the next login that *does* bring a
             * year from Feide would quietly win.
             *
             * So create the row from the member's STUDY group, which carries
             * the same slug as its study programme by the convention the seed
             * establishes and `syncDerivedStudyGroups` relies on.
             */
            if (updated.length === 0 && startYear !== null) {
                const [programme] = await tx
                    .select({ id: schema.studyProgram.id })
                    .from(schema.groupMembership)
                    .innerJoin(
                        schema.group,
                        eq(schema.group.slug, schema.groupMembership.groupSlug),
                    )
                    .innerJoin(
                        schema.studyProgram,
                        eq(schema.studyProgram.slug, schema.group.slug),
                    )
                    .where(
                        and(
                            eq(schema.groupMembership.userId, userId),
                            sql`upper(${schema.group.type}) = 'STUDY'`,
                        ),
                    )
                    .limit(1);

                // No study group either (honorary members, long-gone alumni).
                // The cohort group below is then the only record, which is
                // what every read uses anyway.
                if (programme) {
                    await tx.insert(schema.studyProgramMembership).values({
                        userId,
                        studyProgramId: programme.id,
                        startYear,
                        startYearSource: "manual",
                    });
                }
            }

            /**
             * Clear every cohort group before adding the new one. Members
             * migrated from Lepton can carry more than one — a bachelor who
             * continued into a master — and both `deriveStudy` and the profile
             * endpoint take `Math.max()`, so a leftover higher year would beat
             * the correction we were just asked to make.
             */
            const cohortSlugs = await tx
                .select({ slug: schema.group.slug })
                .from(schema.group)
                .where(sql`upper(${schema.group.type}) = 'STUDYYEAR'`);

            if (cohortSlugs.length > 0) {
                await tx.delete(schema.groupMembership).where(
                    and(
                        eq(schema.groupMembership.userId, userId),
                        inArray(
                            schema.groupMembership.groupSlug,
                            cohortSlugs.map((g) => g.slug),
                        ),
                    ),
                );
            }

            if (startYear === null) return;

            const slug = String(startYear);

            // Created on the fly for the same reason syncDerivedStudyGroups
            // does it: cohort groups are pure labels, and the first member of
            // an intake should not lose their year to a missing row.
            await tx
                .insert(schema.group)
                .values({
                    slug,
                    name: slug,
                    // Upper case to match the rows migrated from Lepton; the
                    // column is a varchar, not the `groupType` enum.
                    type: "STUDYYEAR",
                    finesInfo: "",
                    finesActivated: false,
                })
                .onConflictDoNothing();

            await tx
                .insert(schema.groupMembership)
                .values({ userId, groupSlug: slug, role: "member" })
                .onConflictDoNothing();
        });

        return c.json(
            {
                message:
                    startYear === null
                        ? "Cohort cleared"
                        : `Cohort set to ${startYear}`,
                startYear,
            },
            200,
        );
    },
);
