import { and, eq } from "drizzle-orm";
import { describeRoute, resolver, validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import z from "zod";
import { schema } from "~/db";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { requirePermission } from "~/middleware/permission";

const addMemberSchema = z.object({
    userId: z
        .string()
        .max(255)
        .meta({ description: "User ID to add as member" }),
    role: z
        .enum(["member", "leader"])
        .default("member")
        .meta({ description: "Membership role" }),
});

const addMemberSchemaOpenAPI =
    await resolver(addMemberSchema).toOpenAPISchema();

export const addMemberRoute = route().post(
    "/:groupSlug/members",
    describeRoute({
        tags: ["groups"],
        summary: "Add member to group",
        operationId: "addGroupMember",
        description:
            "Add a member to a group. Requires 'groups:manage' permission.",
        requestBody: {
            content: {
                "application/json": { schema: addMemberSchemaOpenAPI.schema },
            },
        },
        responses: {
            201: {
                description: "Member added successfully",
            },
            400: {
                description:
                    "Bad Request - User already a member or user not found",
            },
            403: {
                description: "Forbidden - Missing groups:manage permission",
            },
            404: {
                description: "Not Found - Group not found",
            },
        },
    }),
    requireAuth,
    requirePermission("groups:manage"),
    validator("json", addMemberSchema),
    async (c) => {
        const body = c.req.valid("json");
        const groupSlug = c.req.param("groupSlug");
        const { db } = c.get("ctx");

        // Validate group exists
        const group = await db
            .select()
            .from(schema.group)
            .where(eq(schema.group.slug, groupSlug))
            .limit(1)
            .then((res) => res[0]);

        if (!group) {
            throw new HTTPException(404, {
                message: `Group with slug "${groupSlug}" not found`,
            });
        }

        // Validate user exists
        const user = await db
            .select()
            .from(schema.user)
            .where(eq(schema.user.id, body.userId))
            .limit(1)
            .then((res) => res[0]);

        if (!user) {
            throw new HTTPException(400, {
                message: `User with ID "${body.userId}" not found`,
            });
        }

        // Check if already a member
        const existingMembership = await db
            .select()
            .from(schema.groupMembership)
            .where(
                and(
                    eq(schema.groupMembership.userId, body.userId),
                    eq(schema.groupMembership.groupSlug, groupSlug),
                ),
            )
            .limit(1);

        if (existingMembership.length > 0) {
            throw new HTTPException(400, {
                message: `User is already a member of group "${groupSlug}"`,
            });
        }

        // Add membership
        const [membership] = await db
            .insert(schema.groupMembership)
            .values({
                userId: body.userId,
                groupSlug: groupSlug,
                role: body.role,
            })
            .returning();

        return c.json(membership, 201);
    },
);
