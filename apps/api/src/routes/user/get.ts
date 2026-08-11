import { HTTPException } from "hono/http-exception";
import { isMemberAudience } from "~/lib/auth";
import { HTTPAppException } from "~/lib/errors";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { deriveStudyFromGroups } from "~/lib/user/study";
import { requireAuthAllowPending } from "~/middleware/auth";
import { userProfileSchema } from "./schema";

/**
 * Another member's profile.
 *
 * Deliberately narrower than the session: bio, links, study and group
 * memberships are what a profile page shows, while e-mail, gender, allergies
 * and the notification settings stay private. Any signed-in member may look up
 * any other — the group member lists already link here.
 *
 * En bruker som venter på godkjenning når bare sin egen profil. De trenger den
 * for å komme til innstillinger og til «Logg ut»; andres profiler er fortsatt
 * medlemsinnhold.
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
        .errorResponses([
            HTTPAppException.Forbidden(
                "Kontoen din venter på godkjenning fra en administrator.",
            ),
        ])
        .build(),
    requireAuthAllowPending,
    async (c) => {
        const { db } = c.get("ctx");
        const identifier = c.req.param("id");
        const viewer = c.get("user");

        const user = await db.query.user.findFirst({
            where: (user, { eq, or }) =>
                or(eq(user.id, identifier), eq(user.username, identifier)),
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
                message: `User "${identifier}" not found`,
            });
        }

        // En bruker som venter på godkjenning slipper inn på sin egen profil,
        // og bare den. Uten dette har de ingen vei til profilsiden — som er
        // det eneste stedet man kan logge ut.
        if (!isMemberAudience(viewer) && user.id !== viewer.id) {
            throw HTTPAppException.Forbidden(
                "Kontoen din venter på godkjenning fra en administrator.",
            );
        }

        const [settings, memberships, history] = await Promise.all([
            db.query.userSettings.findFirst({
                where: (s, { eq }) => eq(s.userId, user.id),
                columns: {
                    imageUrl: true,
                    bioDescription: true,
                    githubUrl: true,
                    linkedinUrl: true,
                },
            }),
            db.query.groupMembership.findMany({
                where: (gm, { eq }) => eq(gm.userId, user.id),
                with: { group: true },
            }),
            db.query.groupMembershipHistory.findMany({
                where: (h, { eq }) => eq(h.userId, user.id),
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
