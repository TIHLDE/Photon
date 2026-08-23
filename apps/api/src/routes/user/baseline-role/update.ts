import { assignUserRole, removeUserRole } from "@photon/auth/roles";
import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import {
    BASELINE_ROLES,
    updateUserBaselineRoleInputSchema,
    updateUserBaselineRoleResponseSchema,
} from "../schema";

/**
 * Move a member between the two baseline roles.
 *
 * `member` and `alumni` are the same pair `syncBaselineRoles` keeps in step
 * with Feide, and the only real difference between them is the right to
 * register for events: alumni keep their profile, their groups, their history
 * and every page a member can read, but the påmelding button is not theirs.
 *
 * Exists because Feide only re-decides when the member logs in with it, so
 * someone who graduated years ago and has not been back still carries `member`,
 * and nothing else ever corrects that. An account still waiting in the approval
 * queue is not this route's case — `approve` takes the role there, so the
 * membership and the role are decided in one act.
 *
 * A dedicated route rather than the generic `POST /roles/:roleId/users`: the
 * two roles are mutually exclusive, and doing it generically means two calls
 * that can half-succeed and leave someone holding both — the one state the
 * rest of the system does not expect. Restricted to those two roles for the
 * same reason it is gated on `users:manage` rather than `roles:assign`: this
 * is the user admin's job, not a way to hand out admin roles.
 */
export const updateUserBaselineRoleRoute = route().patch(
    "/:id/baseline-role",
    describeRoute({
        tags: ["users"],
        summary: "Set a member's baseline role",
        operationId: "updateUserBaselineRole",
        description:
            "Moves the account between 'member' and 'alumni'. Only 'member' may register for events; alumni keep every other kind of access. Setting one removes the other. Requires 'users:manage'.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: updateUserBaselineRoleResponseSchema,
            description: "Baseline role updated",
        })
        .notFound({ description: "User not found" })
        .unauthorized()
        .forbidden({ description: "Requires users:manage" })
        .build(),
    requireAuth,
    requireAccess({ permission: "users:manage" }),
    validator("json", updateUserBaselineRoleInputSchema),
    async (c) => {
        const ctx = c.get("ctx");
        const { db } = ctx;
        const userId = c.req.param("id");
        const { role } = c.req.valid("json");

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
         * Both writes in one transaction, so the account is never left holding
         * both roles or neither. `assignUserRole` throws when the role has not
         * been seeded, which rolls the removal back with it — the honest
         * outcome, since half of this change is not a state worth keeping.
         */
        await db.transaction(async (tx) => {
            const txCtx = { ...ctx, db: tx };
            await assignUserRole(txCtx, userId, role);
            for (const other of BASELINE_ROLES) {
                if (other !== role) {
                    await removeUserRole(txCtx, userId, other);
                }
            }
        });

        return c.json(
            {
                message:
                    role === "alumni"
                        ? "Member moved to alumni"
                        : "Member moved to member",
                role,
            },
            200,
        );
    },
);
