import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import {
    updateUserEmailInputSchema,
    updateUserEmailResponseSchema,
} from "../schema";

/**
 * Change a member's e-mail address on their behalf.
 *
 * The address is the account's login and where password resets go, so whoever
 * can change it can take the account over. That is why this sits behind
 * `root` and not `users:manage`.
 *
 * The usual reason to need it is a member who has lost the inbox on file — an
 * expired `@stud.ntnu.no` address — and so cannot verify or reset their way in.
 * The new address is therefore marked verified: root's word is the proof, and
 * leaving it unverified would lock out exactly the person this is for, since
 * password sign-in demands a verified address and a later Feide link would
 * revoke the password (see `revokeUnprovenCredentials`).
 *
 * The write goes through Better Auth's own `internalAdapter.updateUser` rather
 * than a raw update, so its database hooks run and the member's cached
 * sessions in secondary storage pick up the new address instead of serving
 * the old one until they expire.
 *
 * Sessions are not revoked: changing the address says nothing about who is
 * signed in. Password-reset links already mailed to the old address live in
 * Better Auth's secondary storage keyed by token, so they cannot be found by
 * user here; they expire on their own within the hour.
 */
export const updateUserEmailRoute = route().patch(
    "/:id/email",
    describeRoute({
        tags: ["admin"],
        summary: "Change a member's e-mail address",
        operationId: "updateUserEmail",
        description:
            "Replaces the address the member signs in with and receives mail at. The new address is treated as verified. Requires 'root'.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: updateUserEmailResponseSchema,
            description: "E-mail updated",
        })
        .response({
            statusCode: 409,
            description: "Another account already uses this address",
        })
        .notFound({ description: "User not found" })
        .unauthorized()
        .forbidden({ description: "Requires root" })
        .build(),
    requireAuth,
    requireAccess({ permission: "root" }),
    validator("json", updateUserEmailInputSchema),
    async (c) => {
        const { db, auth } = c.get("ctx");
        const userId = c.req.param("id");
        const { email } = c.req.valid("json");

        const user = await db.query.user.findFirst({
            where: { id: userId },
            columns: { id: true },
        });

        if (!user) {
            throw new HTTPException(404, {
                message: `User "${userId}" not found`,
            });
        }

        const taken = await db.query.user.findFirst({
            where: { email, id: { ne: userId } },
            columns: { id: true },
        });

        if (taken) {
            throw new HTTPException(409, {
                message: "En annen bruker har allerede denne e-postadressen",
            });
        }

        const authContext = await auth.$context;
        await authContext.internalAdapter.updateUser(userId, {
            email,
            emailVerified: true,
        });

        return c.json({ message: "E-mail updated", email }, 200);
    },
);
