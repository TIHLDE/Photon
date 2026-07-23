import { hasPermission } from "@photon/auth/rbac";
import { createRole } from "@photon/auth/roles";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import { createRoleSchema, roleSchema } from "./schema";

export const createRoleRoute = route().post(
    "/",
    describeRoute({
        tags: ["roles"],
        summary: "Create a role",
        operationId: "createRole",
        description:
            "Create a new RBAC role. The role is positioned directly below the creator's highest role. The creator can only grant permissions they hold themselves.",
    })
        .schemaResponse({
            statusCode: 201,
            schema: roleSchema,
            description: "Role created",
        })
        .badRequest({ description: "Invalid input or duplicate name" })
        .forbidden({
            description:
                "Requires roles:create, or tried to grant unheld permissions",
        })
        .build(),
    requireAuth,
    requireAccess({ permission: "roles:create" }),
    validator("json", createRoleSchema),
    async (c) => {
        const ctx = c.get("ctx");
        const user = c.get("user");
        const body = c.req.valid("json");

        // Guardrail: only grant permissions you hold yourself (root holds all)
        for (const permission of body.permissions) {
            if (!(await hasPermission(ctx, user.id, permission))) {
                throw new HTTPException(403, {
                    message: `You cannot grant '${permission}' — you do not hold it yourself`,
                });
            }
        }

        try {
            const role = await createRole(ctx, user.id, {
                name: body.name,
                description: body.description,
                permissions: body.permissions,
            });
            return c.json(
                { ...role, permissions: role.permissions ?? [], users: [] },
                201,
            );
        } catch (error) {
            throw new HTTPException(400, {
                message:
                    error instanceof Error
                        ? error.message
                        : "Failed to create role",
            });
        }
    },
);
