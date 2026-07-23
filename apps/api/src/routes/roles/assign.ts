import {
    getRoleById,
    getUserHighestRolePosition,
    assignUserRole,
    removeUserRole,
} from "@photon/auth/roles";
import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import { assignRoleSchema, roleMessageSchema } from "./schema";

/**
 * Shared hierarchy gate for assigning/removing a role: the actor's highest
 * position must be strictly above the target role's position. Prevents e.g.
 * an AU member (below root) from handing out or revoking the root role.
 */
async function requireAboveRole(
    ctx: Parameters<typeof getRoleById>[0],
    userId: string,
    roleId: number,
) {
    const target = await getRoleById(ctx, roleId);
    if (!target) {
        throw new HTTPException(404, { message: "Role not found" });
    }
    const position = await getUserHighestRolePosition(ctx, userId);
    if (position === null || position <= target.position) {
        throw new HTTPException(403, {
            message:
                "Cannot manage this role — it is at or above your own hierarchy position",
        });
    }
    return target;
}

export const assignRoleRoute = route().post(
    "/:roleId/users",
    describeRoute({
        tags: ["roles"],
        summary: "Assign a role to a user",
        operationId: "assignRole",
        description:
            "Assign a role to a user. Hierarchy applies: you can only assign roles strictly below your own highest role.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: roleMessageSchema,
            description: "Role assigned",
        })
        .forbidden({ description: "Insufficient hierarchy" })
        .notFound({ description: "Role or user not found" })
        .build(),
    requireAuth,
    requireAccess({ permission: "roles:assign" }),
    validator("json", assignRoleSchema),
    async (c) => {
        const ctx = c.get("ctx");
        const user = c.get("user");
        const roleId = Number(c.req.param("roleId"));
        const body = c.req.valid("json");

        if (!Number.isInteger(roleId)) {
            throw new HTTPException(400, { message: "Invalid role id" });
        }

        const target = await requireAboveRole(ctx, user.id, roleId);

        const [targetUser] = await ctx.db
            .select({ id: schema.user.id })
            .from(schema.user)
            .where(eq(schema.user.id, body.userId))
            .limit(1);
        if (!targetUser) {
            throw new HTTPException(404, { message: "User not found" });
        }

        await assignUserRole(ctx, body.userId, target.name);
        return c.json({ message: "Role assigned" });
    },
);

export const unassignRoleRoute = route().delete(
    "/:roleId/users/:userId",
    describeRoute({
        tags: ["roles"],
        summary: "Remove a role from a user",
        operationId: "unassignRole",
        description:
            "Remove a role from a user. Hierarchy applies: you can only remove roles strictly below your own highest role.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: roleMessageSchema,
            description: "Role removed",
        })
        .forbidden({ description: "Insufficient hierarchy" })
        .notFound({ description: "Role not found" })
        .build(),
    requireAuth,
    requireAccess({ permission: "roles:assign" }),
    async (c) => {
        const ctx = c.get("ctx");
        const user = c.get("user");
        const roleId = Number(c.req.param("roleId"));
        const targetUserId = c.req.param("userId");

        if (!Number.isInteger(roleId)) {
            throw new HTTPException(400, { message: "Invalid role id" });
        }

        const target = await requireAboveRole(ctx, user.id, roleId);
        await removeUserRole(ctx, targetUserId, target.name);
        return c.json({ message: "Role removed" });
    },
);
