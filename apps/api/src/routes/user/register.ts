import {
    currentAcademicYear,
    syncBaselineRoles,
    syncDerivedStudyGroups,
} from "@photon/auth/feide";
import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuthOrApiKey } from "~/middleware/auth-or-api-key";
import { registerUserInputSchema, registerUserResponseSchema } from "./schema";

/** API key permissions that may create members. */
const ALLOWED_PERMISSIONS = ["users:create", "root"];

/**
 * Create a member on behalf of another TIHLDE service.
 *
 * Exists for Fadderuka, which runs its own sign-up form during the intake week
 * and used to create the account in Lepton — a system nothing can approve
 * accounts in any more, so every student it registered was left unable to log
 * in anywhere. This route moves that account creation onto Photon without
 * taking the form away from them.
 *
 * Deliberately a thin wrapper around `signUpEmail` rather than an admin-style
 * create: the sign-up hook that demands a @stud.ntnu.no address and derives the
 * username from it, the verification mail, and the password rules all have to
 * apply here exactly as they do on the website. A second way into the user
 * table with its own rules is how the two systems drifted apart in the first
 * place.
 *
 * The caller therefore does NOT choose the username. It is the e-mail's local
 * part, which is the student's NTNU username — the same value Lepton used as
 * `user_id`, so it stays the join key services already hold members by.
 */
export const registerUserRoute = route().post(
    "/register",
    describeRoute({
        tags: ["users"],
        summary: "Register a member from another TIHLDE service",
        operationId: "registerUser",
        description:
            "Creates an account the same way the website's sign-up does — @stud.ntnu.no only, username derived from the address, verification mail sent — and enrols the member in a study programme. Requires an API key with 'users:create'.",
    })
        .schemaResponse({
            statusCode: 201,
            schema: registerUserResponseSchema,
            description: "Member created; a verification mail has been sent",
        })
        .badRequest({
            description:
                "Address is not @stud.ntnu.no, password too short, or the study programme does not exist",
        })
        .unauthorized()
        .forbidden({ description: "Requires an API key with 'users:create'" })
        .build(),
    requireAuthOrApiKey,
    validator("json", registerUserInputSchema),
    async (c) => {
        const { db, auth } = c.get("ctx");

        /**
         * Only API keys, never a session or an OAuth token. A member holding a
         * cookie must not be able to mint accounts, and this route skips the
         * one check the website's own sign-up cannot skip — that the person
         * submitting the form owns the address — because the calling service
         * is trusted to have collected it. That trust belongs to a key.
         */
        const apiKey = c.get("apiKey");
        if (!apiKey) {
            throw new HTTPException(403, {
                message: "This route requires an API key",
            });
        }
        if (!apiKey.permissions.some((p) => ALLOWED_PERMISSIONS.includes(p))) {
            throw new HTTPException(403, {
                message: "API key lacks the 'users:create' permission",
            });
        }

        const { name, email, password, studyProgramSlug } = c.req.valid("json");

        /**
         * Checked before the account is created, not after. `signUpEmail`
         * commits immediately and cannot be rolled back, so a bad slug would
         * otherwise leave a member with no study programme and the caller with
         * an error that reads as "nothing happened".
         */
        const studyGroup = await db.query.group.findFirst({
            where: (g, { eq: equals }) => equals(g.slug, studyProgramSlug),
            columns: { slug: true, type: true },
        });
        if (!studyGroup || studyGroup.type.toLowerCase() !== "study") {
            throw new HTTPException(400, {
                message: `No study programme with slug "${studyProgramSlug}"`,
            });
        }

        let userId: string;
        try {
            const result = await auth.api.signUpEmail({
                body: { name, email, password },
            });
            userId = result.user.id;
        } catch (err) {
            // Better Auth reports the @stud.ntnu.no rule, a weak password and
            // an address already in use as API errors carrying a message the
            // caller can show the student as-is.
            const status =
                typeof (err as { statusCode?: unknown })?.statusCode ===
                "number"
                    ? ((err as { statusCode: number }).statusCode as number)
                    : 400;
            const message =
                typeof (err as { body?: { message?: unknown } })?.body
                    ?.message === "string"
                    ? ((err as { body: { message: string } }).body
                          .message as string)
                    : "Kunne ikke opprette brukeren";
            throw new HTTPException(status === 401 ? 400 : (status as 400), {
                message,
            });
        }

        /**
         * The cohort is assumed to be this intake. Everyone reaching this route
         * is a new student registering during fadderuka, and Feide will not
         * correct it for the programmes that hand out no `fc:fs:kull` — see
         * `syncFeideForUser`. A wrong year here is visible on the profile and
         * fixable from the admin panel; no year at all quietly drops the member
         * out of every cohort-based priority pool.
         */
        await db.transaction(async (tx) => {
            await syncDerivedStudyGroups(
                tx,
                userId,
                studyProgramSlug,
                currentAcademicYear(),
            );
            await syncBaselineRoles(tx, userId, true);
        });

        const created = await db.query.user.findFirst({
            where: eq(schema.user.id, userId),
            columns: { username: true, email: true },
        });

        return c.json(
            {
                id: userId,
                username: created?.username ?? "",
                email: created?.email ?? email,
                emailVerificationRequired: true as const,
            },
            201,
        );
    },
);
