import { HTTPException } from "hono/http-exception";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { deriveStudyFromGroups } from "~/lib/user/study";
import { requireAuth } from "~/middleware/auth";
import { userProfileSchema } from "./schema";

/**
 * Another member's profile.
 *
 * Deliberately narrower than the session: bio, links, study and group
 * memberships are what a profile page shows, while e-mail, gender, allergies
 * and the notification settings stay private. Any signed-in member may look up
 * any other — the group member lists already link here.
 */
export const getUserRoute = route().get(
    "/:id",
    describeRoute({
        tags: ["users"],
        summary: "Get user profile",
        operationId: "getUserProfile",
        description:
            "Public profile of a single user: name, bio, links, study programme and group memberships. Requires being signed in.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: userProfileSchema,
            description: "User profile",
        })
        .notFound({ description: "User not found" })
        .build(),
    requireAuth,
    async (c) => {
        const { db } = c.get("ctx");
        const id = c.req.param("id");

        const user = await db.query.user.findFirst({
            where: (user, { eq }) => eq(user.id, id),
            columns: {
                id: true,
                name: true,
                username: true,
                image: true,
                createdAt: true,
            },
        });

        if (!user) {
            throw new HTTPException(404, {
                message: `User with id "${id}" not found`,
            });
        }

        const [settings, memberships, history] = await Promise.all([
            db.query.userSettings.findFirst({
                where: (s, { eq }) => eq(s.userId, id),
                columns: {
                    imageUrl: true,
                    bioDescription: true,
                    githubUrl: true,
                    linkedinUrl: true,
                },
            }),
            db.query.groupMembership.findMany({
                where: (gm, { eq }) => eq(gm.userId, id),
                with: { group: true },
            }),
            db.query.groupMembershipHistory.findMany({
                where: (h, { eq }) => eq(h.userId, id),
                orderBy: (h, { desc }) => [desc(h.endedAt)],
                with: { group: true },
            }),
        ]);

        // Derived from the group projection, not `studyProgramMembership`;
        // see `deriveStudyFromGroups` for why. The memberships are already
        // loaded above, so this is the pure form rather than a second query.
        const { studyProgram, studyStartYear } = deriveStudyFromGroups(
            memberships.map((m) => m.group),
        );

        /**
         * Ended memberships — the same rule the group page's "tidligere
         * medlemmer" uses, applied per user instead of per group: a group the
         * member rejoined is a current membership and not a former one, and
         * the backfilled Lepton history also holds a row per role change for
         * people who never left. Both fall away by dropping the groups the
         * user is in today. History rows come back newest-first, so the first
         * one seen per group is the most recent stint.
         */
        const currentSlugs = new Set(memberships.map((m) => m.groupSlug));
        const seenSlugs = new Set<string>();
        const formerGroups = history.filter((entry) => {
            if (
                currentSlugs.has(entry.groupSlug) ||
                seenSlugs.has(entry.groupSlug)
            ) {
                return false;
            }
            seenSlugs.add(entry.groupSlug);
            return true;
        });

        return c.json({
            id: user.id,
            name: user.name,
            username: user.username ?? null,
            // The uploaded avatar wins over the one Feide handed us, same as
            // the session's `settings.imageUrl ?? user.image`.
            image: settings?.imageUrl ?? user.image ?? null,
            bio: settings?.bioDescription ?? null,
            githubUrl: settings?.githubUrl ?? null,
            linkedinUrl: settings?.linkedinUrl ?? null,
            studyProgram,
            studyStartYear,
            groups: memberships.map((m) => ({
                slug: m.groupSlug,
                name: m.group.name,
                type: m.group.type,
                logoUrl: m.group.logoUrl ?? null,
                role: m.role,
            })),
            formerGroups: formerGroups.map((entry) => ({
                slug: entry.groupSlug,
                name: entry.group.name,
                type: entry.group.type,
                logoUrl: entry.group.logoUrl ?? null,
                role: entry.role,
                startedAt: entry.startedAt.toISOString(),
                endedAt: entry.endedAt.toISOString(),
            })),
            createdAt: user.createdAt.toISOString(),
        });
    },
);
