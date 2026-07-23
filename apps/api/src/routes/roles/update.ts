import { hasPermission } from "@photon/auth/rbac";
import { getRoleById, getUserHighestRolePosition } from "@photon/auth/roles";
import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import { roleSchema, updateRoleSchema } from "./schema";

export const updateRoleRoute = route().patch(
    "/:roleId",
    describeRoute({
        tags: ["roles"],
        summary: "Update a role",
        operationId: "updateRole",
        description:
            "Update a role's name, description or permissions. Hierarchy applies: you can only edit roles strictly below your own highest role, and only grant permissions you hold yourself.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: roleSchema,
            description: "Role updated",
        })
        .badRequest({ description: "Invalid input" })
        .forbidden({
            description: "Insufficient hierarchy or unheld permissions",
        })
        .notFound({ description: "Role not found" })
        .build(),
    requireAuth,
    requireAccess({ permission: "roles:update" }),
    validator("json", updateRoleSchema),
    async (c) => {
        const ctx = c.get("ctx");
        const { db } = ctx;
        const user = c.get("user");
        const roleId = Number(c.req.param("roleId"));
        const body = c.req.valid("json");

        if (!Number.isInteger(roleId)) {
            throw new HTTPException(400, { message: "Invalid role id" });
        }

        const target = await getRoleById(ctx, roleId);
        if (!target) {
            throw new HTTPException(404, { message: "Role not found" });
        }

        const userPosition = await getUserHighestRolePosition(ctx, user.id);
        if (userPosition === null || userPosition <= target.position) {
            throw new HTTPException(403, {
                message:
                    "Cannot edit this role — it is at or above your own hierarchy position",
            });
        }

        if (body.permissions) {
            for (const permission of body.permissions) {
                if (!(await hasPermission(ctx, user.id, permission))) {
                    throw new HTTPException(403, {
                        message: `You cannot grant '${permission}' — you do not hold it yourself`,
                    });
                }
            }
        }

        const [updated] = await db
            .update(schema.role)
            .set({
                ...(body.name !== undefined && { name: body.name }),
                ...(body.description !== undefined && {
                    description: body.description,
                }),
                ...(body.permissions !== undefined && {
                    permissions: body.permissions,
                }),
            })
            .where(eq(schema.role.id, roleId))
            .returning();

        const users = await db
            .select({
                userId: schema.user.id,
                name: schema.user.name,
                image: schema.user.image,
            })
            .from(schema.userRole)
            .innerJoin(schema.user, eq(schema.userRole.userId, schema.user.id))
            .where(eq(schema.userRole.roleId, roleId));

        return c.json({
            ...updated,
            permissions: updated?.permissions ?? [],
            users,
        });
    },
);
