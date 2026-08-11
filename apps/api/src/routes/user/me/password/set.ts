import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuthAllowPending } from "~/middleware/auth";
import {
    setPasswordInputSchema,
    setPasswordResponseSchema,
} from "../../schema";

/**
 * Give the signed-in member a password when they do not have one yet.
 *
 * Better Auth has no endpoint for this. `/change-password` requires the
 * current password, which a Feide-created account does not have, and
 * `/reset-password` requires a token from an email — so the only way for a
 * member who signed up through Feide to get a password today is to ask for a
 * reset of a password that never existed. That works, but nothing tells them
 * to, and the login page's password form is username-only, so they quietly
 * have no second way in.
 *
 * A session is the whole authorisation here, exactly as it is for the reset
 * link: both prove the account is theirs. The route therefore only *adds* a
 * credential — it refuses when one already exists rather than overwriting it,
 * since replacing a known password is `/change-password`'s job and must go on
 * asking for the old one.
 */
export const setPasswordRoute = route().post(
    "/",
    describeRoute({
        tags: ["users"],
        summary: "Set a password for an account that has none",
        operationId: "setPassword",
        description:
            "Adds a username/password login to the authenticated user, for accounts created through Feide. Refuses if the account already has a password — use the password reset flow to change an existing one.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: setPasswordResponseSchema,
            description: "Password set",
        })
        .badRequest({ description: "Invalid password" })
        .response({
            statusCode: 409,
            description: "The account already has a password",
        })
        .build(),
    requireAuthAllowPending,
    validator("json", setPasswordInputSchema),
    async (c) => {
        const user = c.get("user");
        const { newPassword } = c.req.valid("json");
        const { auth } = c.get("ctx");

        const authContext = await auth.$context;

        /**
         * Better Auth's own bounds rather than a second opinion: they are what
         * `/sign-in/username` will hold the password to, so a password this
         * route accepts and that endpoint rejects would be unusable.
         */
        const { minPasswordLength, maxPasswordLength } =
            authContext.password.config;
        if (
            newPassword.length < minPasswordLength ||
            newPassword.length > maxPasswordLength
        ) {
            throw new HTTPException(400, {
                message: `Passordet må være mellom ${minPasswordLength} og ${maxPasswordLength} tegn.`,
            });
        }

        const accounts = await authContext.internalAdapter.findAccounts(
            user.id,
        );
        if (accounts.some((a) => a.providerId === "credential")) {
            throw new HTTPException(409, {
                message:
                    "Kontoen har allerede et passord. Bruk «Glemt passord» for å endre det.",
            });
        }

        await authContext.internalAdapter.createAccount({
            userId: user.id,
            providerId: "credential",
            accountId: user.id,
            password: await authContext.password.hash(newPassword),
        });

        return c.json({ success: true }, 200);
    },
);
