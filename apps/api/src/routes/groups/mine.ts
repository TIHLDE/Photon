import { schema } from "@photon/db";
import { asc, eq } from "drizzle-orm";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { myGroupsListSchema } from "./schema";

export const mineRoute = route().get(
    "/mine",
    describeRoute({
        tags: ["groups"],
        summary: "List current user's groups",
        operationId: "listMyGroups",
        description:
            "Retrieve all groups the authenticated user is a member of, including membership info.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: myGroupsListSchema,
            description: "List of groups the user is a member of",
        })
        .build(),
    requireAuth,
    async (c) => {
        const { db } = c.get("ctx");
        const userId = c.get("user").id;

        const results = await db
            .select({
                slug: schema.group.slug,
                imageUrl: schema.group.imageUrl,
                name: schema.group.name,
                description: schema.group.description,
                contactEmail: schema.group.contactEmail,
                type: schema.group.type,
                finesInfo: schema.group.finesInfo,
                finesActivated: schema.group.finesActivated,
                finesAdminId: schema.group.finesAdminId,
                createdAt: schema.group.createdAt,
                updatedAt: schema.group.updatedAt,
                membershipRole: schema.groupMembership.role,
                membershipCreatedAt: schema.groupMembership.createdAt,
                membershipUpdatedAt: schema.groupMembership.updatedAt,
            })
            .from(schema.groupMembership)
            .innerJoin(
                schema.group,
                eq(schema.groupMembership.groupSlug, schema.group.slug),
            )
            .where(eq(schema.groupMembership.userId, userId))
            .orderBy(asc(schema.group.name));

        const groups = results.map((row) => ({
            slug: row.slug,
            imageUrl: row.imageUrl,
            name: row.name,
            description: row.description,
            contactEmail: row.contactEmail,
            type: row.type,
            finesInfo: row.finesInfo,
            finesActivated: row.finesActivated,
            finesAdminId: row.finesAdminId,
            createdAt: row.createdAt.toISOString(),
            updatedAt: row.updatedAt.toISOString(),
            membership: {
                role: row.membershipRole,
                joinedAt: row.membershipCreatedAt.toISOString(),
                updatedAt: row.membershipUpdatedAt.toISOString(),
            },
        }));

        return c.json(groups);
    },
);
