import { schema } from "@photon/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import { updateStudyInputSchema, updateStudyResponseSchema } from "../schema";

/**
 * Correct which study programme a member is registered on.
 *
 * The companion to the cohort correction next door. STUDY groups are derived
 * from Feide, so the three group-membership routes refuse to touch them — and
 * that leaves no way at all to fix the members Feide never speaks for: the
 * 1667 carried over from Lepton with whatever programme the old database held,
 * and anyone registered by hand during fadderuka on the wrong programme. The
 * programme decides what the profile says and which priority pools they fall
 * into, so getting it wrong is not cosmetic.
 *
 * Replaces rather than adds: the old STUDY group goes, because a member is on
 * one programme and two would leave every read picking whichever it happened
 * to see first. That is the one place this differs from the Feide sync, which
 * is additive on purpose — this route exists precisely to say "that programme
 * is wrong", not "they have since started another one".
 *
 * `studyProgramMembership` is deliberately left alone. That table is Feide's
 * record of enrolment — it carries the confirmed campus that keeps a member's
 * access alive, and rows accumulate per programme for a reason. Rewriting it
 * from an admin panel would throw away evidence we cannot recreate, and no
 * read of a member's programme goes through it anyway; see `lib/user/study.ts`.
 * A later Feide login can therefore re-add the programme NTNU reports, which
 * is the correct outcome when NTNU and the admin disagree about a real student.
 */
export const updateStudyRoute = route().patch(
    "/:id/study",
    describeRoute({
        tags: ["users"],
        summary: "Correct a member's study programme",
        operationId: "updateUserStudy",
        description:
            "Move a member to another STUDY group, replacing the one they have. Null removes it. Requires 'users:manage'.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: updateStudyResponseSchema,
            description: "Study programme updated",
        })
        .badRequest({ description: "No STUDY group with that slug" })
        .notFound({ description: "User not found" })
        .unauthorized()
        .forbidden({ description: "Requires users:manage" })
        .build(),
    requireAuth,
    requireAccess({ permission: "users:manage" }),
    validator("json", updateStudyInputSchema),
    async (c) => {
        const { db } = c.get("ctx");
        const userId = c.req.param("id");
        const { studyProgramSlug } = c.req.valid("json");

        const user = await db.query.user.findFirst({
            where: eq(schema.user.id, userId),
            columns: { id: true },
        });

        if (!user) {
            throw new HTTPException(404, {
                message: `User "${userId}" not found`,
            });
        }

        /**
         * Resolved before anything is deleted, so a typo cannot leave a member
         * with no programme at all. Study groups are curated — names,
         * descriptions and images no code should invent — so an unknown slug
         * is an error rather than something to create on the fly, unlike the
         * cohort groups.
         */
        let target: { slug: string; name: string } | null = null;

        if (studyProgramSlug !== null) {
            const group = await db.query.group.findFirst({
                where: eq(schema.group.slug, studyProgramSlug),
                columns: { slug: true, name: true, type: true },
            });

            // Type is a varchar holding upper-case values from Lepton, not the
            // `groupType` enum; compare case-insensitively.
            if (!group || group.type.toLowerCase() !== "study") {
                throw new HTTPException(400, {
                    message: `No study programme with slug "${studyProgramSlug}"`,
                });
            }

            target = { slug: group.slug, name: group.name };
        }

        await db.transaction(async (tx) => {
            const studySlugs = await tx
                .select({ slug: schema.group.slug })
                .from(schema.group)
                .where(sql`upper(${schema.group.type}) = 'STUDY'`);

            if (studySlugs.length > 0) {
                await tx.delete(schema.groupMembership).where(
                    and(
                        eq(schema.groupMembership.userId, userId),
                        inArray(
                            schema.groupMembership.groupSlug,
                            studySlugs.map((g) => g.slug),
                        ),
                    ),
                );
            }

            if (!target) return;

            await tx
                .insert(schema.groupMembership)
                .values({ userId, groupSlug: target.slug, role: "member" })
                .onConflictDoNothing();
        });

        return c.json(
            {
                message: target
                    ? `Study programme set to ${target.name}`
                    : "Study programme cleared",
                studyProgram: target?.name ?? null,
                studyProgramSlug: target?.slug ?? null,
            },
            200,
        );
    },
);
