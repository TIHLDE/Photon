import { schema } from "@photon/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { listMemberStudyPrograms } from "~/lib/user/study";
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
 * Writing `manual` is the point: it outranks every other source in the sync's
 * conflict guard, so the correction survives every later login instead of being
 * quietly reverted. The three group-membership routes still refuse to touch
 * STUDYYEAR groups directly — this is the only sanctioned way in, and it keeps
 * the cohort group and the study-programme row from drifting apart.
 *
 * Scoped to one programme. It used to write the year onto *every* row the
 * member had, which quietly destroys the one thing this whole model exists to
 * express: a member who took a bachelor from 2023 and started a master in 2026
 * has two programmes with two different intakes, and flattening them is exactly
 * the confusion that left first-year masters indistinguishable from
 * third-year bachelors. Without an explicit programme the correction lands on
 * the member's *current* one — the study the admin sees in the row they clicked.
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
        const ctx = c.get("ctx");
        const { db } = ctx;
        const userId = c.req.param("id");
        const { startYear, studyProgramSlug } = c.req.valid("json");

        const user = await db.query.user.findFirst({
            where: eq(schema.user.id, userId),
            columns: { id: true },
        });

        if (!user) {
            throw new HTTPException(404, {
                message: `User "${userId}" not found`,
            });
        }

        const programmes = await listMemberStudyPrograms(ctx, userId);

        /**
         * Without an explicit programme the correction lands on the member's
         * current one, which is the study the admin was looking at when they
         * opened the dialog. Passing the slug is for the rarer case of
         * correcting the programme they are *not* on any more.
         */
        const target = studyProgramSlug
            ? programmes.find((p) => p.slug === studyProgramSlug)
            : programmes[0];

        if (studyProgramSlug && !target) {
            throw new HTTPException(400, {
                message:
                    `User "${userId}" has no tie to study programme ` +
                    `"${studyProgramSlug}". They belong to: ` +
                    (programmes.map((p) => p.slug).join(", ") || "none"),
            });
        }

        await db.transaction(async (tx) => {
            if (target) {
                const [updated] = await tx
                    .update(schema.studyProgramMembership)
                    .set({
                        startYear,
                        startYearSource: "manual",
                        updatedAt: new Date(),
                    })
                    .where(
                        and(
                            eq(schema.studyProgramMembership.userId, userId),
                            eq(
                                schema.studyProgramMembership.studyProgramId,
                                target.id,
                            ),
                        ),
                    )
                    .returning({
                        userId: schema.studyProgramMembership.userId,
                    });

                /**
                 * Members migrated from Lepton have no programme row — the
                 * table is only ever written by a Feide login — so there is
                 * nowhere to record that the cohort was set by hand, and the
                 * next login that *does* bring a year would quietly win.
                 * Create it from the programme we just resolved.
                 */
                if (!updated && startYear !== null) {
                    await tx.insert(schema.studyProgramMembership).values({
                        userId,
                        studyProgramId: target.id,
                        startYear,
                        startYearSource: "manual",
                    });
                }
            }

            /**
             * A master owns no cohort group — its intake lives on the
             * programme row alone, because a cohort group is slugged as a bare
             * year and would mix master students into the inherited pools
             * aimed at that year's bachelor intake. So correcting a master's
             * year must leave the member's groups exactly as they are: the
             * only group carrying a year is their bachelor's, and it is not
             * ours to move.
             */
            if (target?.isMaster) return;

            /**
             * Clear the cohort group the correction replaces, then add the new
             * one. Only the year this programme used to hold: a member who
             * transferred carries a group per intake, and the blanket delete
             * this once did took their history with it.
             *
             * With no previous year on record there is nothing to aim at, so
             * every cohort group goes — the member has no per-programme
             * history for us to preserve, and leaving a stale year behind
             * would beat the correction, since `deriveStudyFromGroups` takes
             * `Math.max()` over the groups.
             */
            const doomed =
                target?.startYear !== null && target?.startYear !== undefined
                    ? [String(target.startYear)]
                    : (
                          await tx
                              .select({ slug: schema.group.slug })
                              .from(schema.group)
                              .where(
                                  sql`upper(${schema.group.type}) = 'STUDYYEAR'`,
                              )
                      ).map((g) => g.slug);

            if (doomed.length > 0) {
                await tx
                    .delete(schema.groupMembership)
                    .where(
                        and(
                            eq(schema.groupMembership.userId, userId),
                            inArray(schema.groupMembership.groupSlug, doomed),
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
