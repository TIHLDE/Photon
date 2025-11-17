import { eq } from "drizzle-orm";
import { describeRoute, resolver, validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import z from "zod";
import { schema } from "~/db";
import { isGroupLeader } from "~/lib/group/middleware";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { requireOwnershipOrScopedPermission } from "~/middleware/ownership";

const updateGroupSchema = z.object({
    imageUrl: z
        .string()
        .url()
        .max(600)
        .optional()
        .meta({ description: "Group image URL" }),
    name: z
        .string()
        .min(1)
        .max(128)
        .optional()
        .meta({ description: "Group name" }),
    description: z
        .string()
        .optional()
        .nullable()
        .meta({ description: "Group description" }),
    contactEmail: z
        .string()
        .email()
        .max(200)
        .optional()
        .nullable()
        .meta({ description: "Group contact email" }),
    type: z.string().max(50).optional().meta({ description: "Group type" }),
    finesInfo: z
        .string()
        .optional()
        .meta({ description: "Information about group fines policy" }),
    finesActivated: z
        .boolean()
        .optional()
        .meta({ description: "Whether fines are activated for this group" }),
    finesAdminId: z
        .string()
        .max(255)
        .optional()
        .nullable()
        .meta({ description: "User ID of the fines administrator" }),
});

const updateGroupSchemaOpenAPI =
    await resolver(updateGroupSchema).toOpenAPISchema();

export const updateRoute = route().patch(
    "/:slug",
    describeRoute({
        tags: ["groups"],
        summary: "Partially update group",
        operationId: "updateGroup",
        description:
            "Partially update an existing group by its slug. Only provided fields will be updated. Requires being a group leader OR having 'groups:update' permission (globally or scoped to this group).",
        requestBody: {
            content: {
                "application/json": { schema: updateGroupSchemaOpenAPI.schema },
            },
        },
        responses: {
            200: {
                description: "Group updated successfully",
            },
            400: {
                description: "Bad Request - Invalid input",
            },
            403: {
                description:
                    "Forbidden - Not a group leader or missing groups:update permission",
            },
            404: {
                description:
                    "Not Found - Group with the specified slug does not exist",
            },
        },
    }),
    requireAuth,
    requireOwnershipOrScopedPermission(
        "slug",
        isGroupLeader,
        "groups:update",
        (c) => `group:${c.req.param("slug")}`,
    ),
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
