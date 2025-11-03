import { eq } from "drizzle-orm";
import { describeRoute, resolver } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import z from "zod";
import { schema } from "~/db";
import { route } from "~/lib/route";

const memberSchema = z.object({
    userId: z.string().meta({ description: "User ID" }),
    groupSlug: z.string().meta({ description: "Group slug" }),
    role: z.string().meta({ description: "Membership role" }),
    createdAt: z
        .string()
        .meta({ description: "Membership creation timestamp" }),
    updatedAt: z.string().meta({ description: "Membership update timestamp" }),
});

const memberListSchema = z.array(memberSchema);

export const listMembersRoute = route().get(
    "/:groupSlug/members",
    describeRoute({
        tags: ["groups"],
        summary: "List group members",
        description: "Retrieve a list of all members in a group.",
        responses: {
            200: {
                description: "List of members retrieved successfully",
                content: {
                    "application/json": {
                        schema: resolver(memberListSchema),
                    },
                },
            },
            404: {
                description: "Not Found - Group not found",
            },
        },
    }),
    async (c) => {
        const { db } = c.get("ctx");
        const groupSlug = c.req.param("groupSlug");

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

        // Get members
        const members = await db
            .select()
            .from(schema.groupMembership)
            .where(eq(schema.groupMembership.groupSlug, groupSlug));

        return c.json(members);
    },
);
