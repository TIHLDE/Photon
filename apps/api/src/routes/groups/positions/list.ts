import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
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
        .build(),
    requireAuth,
    async (c) => {
        const { db } = c.get("ctx");
        const groupSlug = c.req.param("groupSlug");

        const [group] = await db
            .select({ slug: schema.group.slug })
            .from(schema.group)
            .where(eq(schema.group.slug, groupSlug))
            .limit(1);

        if (!group) {
            throw new HTTPException(404, {
                message: `Group with slug "${groupSlug}" not found`,
            });
        }

        const positions = await db.query.groupPosition.findMany({
            where: eq(schema.groupPosition.groupSlug, groupSlug),
            with: {
                holders: {
                    with: {
                        user: {
                            columns: { id: true, name: true, image: true },
                        },
                    },
                },
            },
            orderBy: (position, { asc }) => [asc(position.name)],
        });

        return c.json(
            positions.map((position) => ({
                id: position.id,
                groupSlug: position.groupSlug,
                name: position.name,
                description: position.description,
                permissions: position.permissions,
                scope: position.scope,
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
