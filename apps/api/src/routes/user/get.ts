import { HTTPException } from "hono/http-exception";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
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

        const [settings, memberships] = await Promise.all([
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
        ]);

        /**
         * Study programme and cohort mirror `listUsers`: they are a projection
         * of Feide onto ordinary groups (types STUDY/STUDYYEAR), not
         * `studyProgramMembership` — that table only gets rows from a Feide
         * login, so everyone migrated from Lepton is missing there. The type is
         * stored in UPPERCASE from Lepton, hence the case-insensitive compare.
         */
        const study = memberships.find(
            (m) => m.group.type.toLowerCase() === "study",
        );

        // Several cohorts can linger on one account (a bachelor who continued
        // into a master). The most recent one is the useful one.
        const startYears = memberships
            .filter((m) => m.group.type.toLowerCase() === "studyyear")
            .map((m) => Number.parseInt(m.group.name, 10))
            .filter((year) => Number.isFinite(year));

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
            studyProgram: study?.group.name ?? null,
            studyStartYear:
                startYears.length > 0 ? Math.max(...startYears) : null,
            groups: memberships.map((m) => ({
                slug: m.groupSlug,
                name: m.group.name,
                type: m.group.type,
                logoUrl: m.group.logoUrl ?? null,
                role: m.role,
            })),
            createdAt: user.createdAt.toISOString(),
        });
    },
);
