import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import {
    canGrantPositionPermissions,
    canManagePositions,
} from "~/lib/group/positions";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { createPositionSchema, positionSchema } from "./schema";

export const createPositionRoute = route().post(
    "/:groupSlug/positions",
    describeRoute({
        tags: ["positions"],
        summary: "Create a position",
        operationId: "createGroupPosition",
        description:
            "Create a new position (verv) in a group. Group leaders can create group-scoped positions limited to permissions they themselves hold in the group. Positions with global scope require the global 'roles:create' permission, and the creator must hold every granted permission globally.",
    })
        .schemaResponse({
            statusCode: 201,
            schema: positionSchema,
            description: "Position created",
        })
        .badRequest({ description: "Invalid input" })
        .forbidden({
            description:
                "Not authorized to create positions, or tried to grant permissions the creator does not hold",
        })
        .notFound({ description: "Group not found" })
        .build(),
    requireAuth,
    validator("json", createPositionSchema),
    async (c) => {
        const ctx = c.get("ctx");
        const { db } = ctx;
        const user = c.get("user");
        const groupSlug = c.req.param("groupSlug");
        const body = c.req.valid("json");

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

        if (!(await canManagePositions(ctx, user.id, groupSlug, body.scope))) {
            throw new HTTPException(403, {
                message:
                    body.scope === "global"
                        ? "Creating global positions requires the 'roles:create' permission"
                        : "Not authorized to manage positions for this group",
            });
        }

        if (
            !(await canGrantPositionPermissions(
                ctx,
                user.id,
                groupSlug,
                body.permissions,
                body.scope,
            ))
        ) {
            throw new HTTPException(403, {
                message:
                    "You can only grant permissions you hold yourself at the position's scope",
            });
        }

        // Duplicate names are allowed on purpose: a position has one holder,
        // so a second "Økonomiansvarlig" is simply a second position.
        const [position] = await db
            .insert(schema.groupPosition)
            .values({
                groupSlug,
                name: body.name,
                description: body.description,
                permissions: body.permissions,
                scope: body.scope,
            })
            .returning();

        if (!position) {
            throw new HTTPException(500, {
                message: "Failed to create position",
            });
        }

        return c.json({ ...position, holder: null }, 201);
    },
);
