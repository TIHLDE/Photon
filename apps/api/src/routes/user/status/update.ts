import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { assertNotAboveActor, revokeUserAccess } from "~/lib/user-access";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import {
    updateUserStatusInputSchema,
    updateUserStatusResponseSchema,
} from "../schema";

/**
 * Deactivate or reactivate a member.
 *
 * Written onto Better Auth's own `banned` column rather than a column of our
 * own: that flag is already checked at sign-in, so a deactivated account is
 * shut out by the auth layer instead of by a rule every route would have to
 * remember. Existing sessions are revoked as well — without that, deactivation
 * would not take hold until the current session expired.
 *
 * Deliberately not a delete. Registrations, fines and group history all point
 * at the user, and removing the row would take the record with it.
 */
export const updateUserStatusRoute = route().patch(
    "/:id/status",
    describeRoute({
        tags: ["users"],
        summary: "Activate or deactivate a member",
        operationId: "updateUserStatus",
        description:
            "Deactivating blocks sign-in and ends the member's sessions and OAuth grants; the account and its history are kept. Requires 'users:manage', and root or a higher role to act on someone holding those.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: updateUserStatusResponseSchema,
            description: "Status updated",
        })
        .badRequest({ description: "Cannot deactivate your own account" })
        .notFound({ description: "User not found" })
        .unauthorized()
        .forbidden({
            description: "Requires users:manage, and not outranked by the user",
        })
        .build(),
    requireAuth,
    requireAccess({ permission: "users:manage" }),
    validator("json", updateUserStatusInputSchema),
    async (c) => {
        const ctx = c.get("ctx");
        const { db } = ctx;
        const userId = c.req.param("id");
        const { isActive, reason } = c.req.valid("json");

        // Locking yourself out is never the intent, and there may be no one
        // else left holding `users:manage` to undo it.
        if (!isActive && userId === c.get("user").id) {
            throw new HTTPException(400, {
                message: "You cannot deactivate your own account",
            });
        }

        const user = await db.query.user.findFirst({
            where: { id: userId },
            columns: { id: true },
        });

        if (!user) {
            throw new HTTPException(404, {
                message: `User "${userId}" not found`,
            });
        }

        await assertNotAboveActor(ctx, c.get("user").id, userId);

        await db
            .update(schema.user)
            .set({
                banned: !isActive,
                banReason: isActive ? null : (reason ?? null),
                // Null means "no end date" — a deactivation lasts until
                // someone reverses it.
                banExpires: null,
                updatedAt: new Date(),
            })
            .where(eq(schema.user.id, userId));

        // After the ban, so a sign-in racing this cannot leave a new session.
        if (!isActive) {
            await revokeUserAccess(ctx, userId);
        }

        return c.json(
            {
                message: isActive ? "Account activated" : "Account deactivated",
                isActive,
            },
            200,
        );
    },
);
