import { schema } from "@photon/db";
import { desc, eq } from "drizzle-orm";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import { roleListSchema } from "./schema";

export const listRolesRoute = route().get(
    "/",
    describeRoute({
        tags: ["roles"],
        summary: "List roles",
        operationId: "listRoles",
        description:
            "List all RBAC roles with their permissions and assigned users, ordered by hierarchy position (highest first).",
    })
        .schemaResponse({
            statusCode: 200,
            schema: roleListSchema,
            description: "List of roles",
        })
        .forbidden({ description: "Requires roles:view" })
        .build(),
    requireAuth,
    requireAccess({ permission: ["roles:view", "roles:assign"] }),
    async (c) => {
        const { db } = c.get("ctx");

        const roles = await db
            .select()
            .from(schema.role)
            .orderBy(desc(schema.role.position));

        const assignments = await db
            .select({
                roleId: schema.userRole.roleId,
                userId: schema.user.id,
                name: schema.user.name,
                image: schema.user.image,
            })
            .from(schema.userRole)
            .innerJoin(schema.user, eq(schema.userRole.userId, schema.user.id));

        const usersByRole = new Map<
            number,
            { userId: string; name: string | null; image: string | null }[]
        >();
        for (const a of assignments) {
            const list = usersByRole.get(a.roleId) ?? [];
            list.push({ userId: a.userId, name: a.name, image: a.image });
            usersByRole.set(a.roleId, list);
        }

        return c.json(
            roles.map((r) => ({
                ...r,
                permissions: r.permissions ?? [],
                users: usersByRole.get(r.id) ?? [],
            })),
        );
    },
);
