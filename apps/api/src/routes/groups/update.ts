import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { isGroupLeader } from "~/lib/group/middleware";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import { updateGroupResponseSchema, updateGroupSchema } from "./schema";

export const updateRoute = route().patch(
    "/:slug",
    describeRoute({
        tags: ["groups"],
        summary: "Partially update group",
        operationId: "updateGroup",
        description:
            "Partially update an existing group by its slug. Only provided fields will be updated. Requires being a group leader OR having 'groups:update' permission (globally or scoped to this group).",
    })
        .schemaResponse({
            statusCode: 200,
            schema: updateGroupResponseSchema,
            description: "Group updated successfully",
        })
        .badRequest({ description: "Invalid input" })
        .forbidden({
            description:
                "Not a group leader or missing groups:update permission",
        })
        .notFound({
            description: "Group with the specified slug does not exist",
        })
        .build(),
    requireAuth,
    requireAccess({
        permission: "groups:update",
        scope: (c) => `group:${c.req.param("slug")}`,
        ownership: { param: "slug", check: isGroupLeader },
    }),
    validator("json", updateGroupSchema),
    async (c) => {
        const body = c.req.valid("json");
        const slug = c.req.param("slug");
        const { db } = c.get("ctx");

        // Check if group exists
        const existingGroup = await db
            .select()
            .from(schema.group)
            .where(eq(schema.group.slug, slug))
            .limit(1);

        if (existingGroup.length === 0) {
            throw new HTTPException(404, {
                message: `Group with slug "${slug}" not found`,
            });
        }

        // Validate fines admin if provided
        if (body.finesAdminId !== undefined && body.finesAdminId !== null) {
            const finesAdmin = await db
                .select()
                .from(schema.user)
                .where(eq(schema.user.id, body.finesAdminId))
                .limit(1);

            if (finesAdmin.length === 0) {
                throw new HTTPException(400, {
                    message: `User with ID "${body.finesAdminId}" does not exist`,
                });
            }
        }

        await db
            .update(schema.group)
            .set({
                ...body,
                updatedAt: new Date(),
            })
            .where(eq(schema.group.slug, slug));

        return c.json({ message: "Group updated successfully" }, 200);
    },
);
