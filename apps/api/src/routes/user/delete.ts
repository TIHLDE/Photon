import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";

/**
 * Delete a member's account for good.
 *
 * The blunt instrument, kept next to `PATCH /:id/status` on purpose: almost
 * every reason to remove someone is served better by deactivating them, which
 * keeps registrations, fines and group history intact. This route is for the
 * cases where the record itself has to go — a duplicate account, a test user,
 * or a deletion request under GDPR.
 *
 * Everything hanging off the user cascades away with the row: registrations,
 * payments, fines, memberships, membership history, contract signatures,
 * sessions and role grants. Authored content (news, events, gallery albums)
 * has its author set to null and survives.
 */
export const deleteUserRoute = route().delete(
    "/:id",
    describeRoute({
        tags: ["users"],
        summary: "Delete a member permanently",
        operationId: "deleteUser",
        description:
            "Irreversibly deletes the account along with its registrations, payments, fines, memberships and history. Prefer 'PATCH /user/{id}/status' to deactivate instead. Requires 'users:delete'.",
    })
        .response({
            statusCode: 204,
            description: "User deleted",
        })
        .badRequest({ description: "Cannot delete your own account" })
        .notFound({ description: "User not found" })
        .unauthorized()
        .forbidden({ description: "Requires users:delete" })
        .build(),
    requireAuth,
    requireAccess({ permission: "users:delete" }),
    async (c) => {
        const { db } = c.get("ctx");
        const userId = c.req.param("id");

        // Same guard as deactivation: there may be no one else left holding
        // the permission needed to undo it — and here there is no undo at all.
        if (userId === c.get("user").id) {
            throw new HTTPException(400, {
                message: "You cannot delete your own account",
            });
        }

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
            // `group.fines_admin_id` is the one reference to a user that does
            // not cascade or null itself — left alone it would abort the
            // delete with a foreign key violation.
            await tx
                .update(schema.group)
                .set({ finesAdminId: null })
                .where(eq(schema.group.finesAdminId, userId));

            await tx.delete(schema.user).where(eq(schema.user.id, userId));
        });

        return c.body(null, 204);
    },
);
