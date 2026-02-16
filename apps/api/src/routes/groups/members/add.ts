import { requireAccess, requireAuth } from "@photon/auth/server";
import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import z from "zod";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";

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

export const addMemberRoute = route().post(
    "/:groupSlug/members",
    describeRoute({
        tags: ["groups"],
        summary: "Add member to group",
        operationId: "addGroupMember",
        description:
            "Add a member to a group. Requires 'groups:manage' permission.",
    })
        .response({ statusCode: 201, description: "Member added successfully" })
        .badRequest({ description: "User already a member or user not found" })
        .notFound({ description: "Group not found" })
        .build(),
    requireAuth,
    requireAccess({ permission: "groups:manage" }),
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
