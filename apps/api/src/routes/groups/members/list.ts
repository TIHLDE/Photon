import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { memberListSchema } from "../schema";

export const listMembersRoute = route().get(
    "/:groupSlug/members",
    describeRoute({
        tags: ["groups"],
        summary: "List group members",
        operationId: "listGroupMembers",
        description: "Retrieve a list of all members in a group.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: memberListSchema,
            description: "List of members retrieved successfully",
        })
        .notFound({ description: "Group not found" })
        .build(),
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
