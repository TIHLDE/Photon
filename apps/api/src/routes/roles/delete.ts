import { deleteRole } from "@photon/auth/roles";
import { HTTPException } from "hono/http-exception";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import { roleMessageSchema } from "./schema";

export const deleteRoleRoute = route().delete(
    "/:roleId",
    describeRoute({
        tags: ["roles"],
        summary: "Delete a role",
        operationId: "deleteRole",
        description:
            "Delete a role. Hierarchy applies: you can only delete roles strictly below your own highest role. Assignments are removed with it.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: roleMessageSchema,
            description: "Role deleted",
        })
        .forbidden({ description: "Insufficient hierarchy" })
        .notFound({ description: "Role not found" })
        .build(),
    requireAuth,
    requireAccess({ permission: "roles:delete" }),
    async (c) => {
        const ctx = c.get("ctx");
        const user = c.get("user");
        const roleId = Number(c.req.param("roleId"));

        if (!Number.isInteger(roleId)) {
            throw new HTTPException(400, { message: "Invalid role id" });
        }

        try {
            await deleteRole(ctx, user.id, roleId);
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "Failed to delete";
            if (message.includes("not found")) {
                throw new HTTPException(404, { message });
            }
            throw new HTTPException(403, { message });
        }

        return c.json({ message: "Role deleted" });
    },
);
