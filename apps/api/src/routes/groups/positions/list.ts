import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { assertGroupVisible } from "~/lib/group";
import { readLinkedPositionPermissionsBatch } from "~/lib/group/linked-leader";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { positionListSchema } from "./schema";

export const listPositionsRoute = route().get(
    "/:groupSlug/positions",
    describeRoute({
        tags: ["positions"],
        summary: "List positions for a group",
        operationId: "listGroupPositions",
        description:
            "Retrieve all positions (verv) for a group, with their holders.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: positionListSchema,
            description: "List of positions",
        })
        .notFound({ description: "Group not found" })
        .forbidden({
            description: "The group is private and you are not a member",
        })
        .build(),
    requireAuth,
    async (c) => {
        const ctx = c.get("ctx");
        const { db } = ctx;
        const groupSlug = c.req.param("groupSlug");

        const [group] = await db
            .select({ slug: schema.group.slug, type: schema.group.type })
            .from(schema.group)
            .where(eq(schema.group.slug, groupSlug))
            .limit(1);

        if (!group) {
            throw new HTTPException(404, {
                message: `Group with slug "${groupSlug}" not found`,
            });
        }

        await assertGroupVisible(ctx, group, c.get("user").id);

        const positions = await db.query.groupPosition.findMany({
            where: eq(schema.groupPosition.groupSlug, groupSlug),
            with: {
                holders: {
                    with: {
                        user: {
                            columns: { id: true, name: true, image: true },
                        },
                    },
                    orderBy: (holder, { asc }) => [asc(holder.createdAt)],
                },
            },
            orderBy: (position, { asc }) => [asc(position.name)],
        });

        // A verv linked to a subgroup shares its grant with that subgroup's
        // org-wide leader permissions, so show the two as the one set they
        // effectively are (see lib/group/linked-leader.ts).
        const permissionsById = await readLinkedPositionPermissionsBatch(
            ctx,
            positions,
        );

        return c.json(
            positions.map((position) => ({
                id: position.id,
                groupSlug: position.groupSlug,
                name: position.name,
                description: position.description,
                permissions:
                    permissionsById.get(position.id) ?? position.permissions,
                scope: position.scope,
                linkedGroupSlug: position.linkedGroupSlug,
                holders: position.holders.map((holder) => ({
                    userId: holder.user.id,
                    name: holder.user.name,
                    image: holder.user.image,
                })),
                createdAt: position.createdAt,
                updatedAt: position.updatedAt,
            })),
        );
    },
);
