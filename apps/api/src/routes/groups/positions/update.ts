import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import {
    mirrorIntoLinkedGroup,
    readLinkedPositionPermissions,
} from "~/lib/group/linked-leader";
import {
    canGrantPositionPermissions,
    canManagePositions,
    getPosition,
} from "~/lib/group/positions";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { positionSchema, updatePositionSchema } from "./schema";

export const updatePositionRoute = route().patch(
    "/:groupSlug/positions/:positionId",
    describeRoute({
        tags: ["positions"],
        summary: "Update a position",
        operationId: "updateGroupPosition",
        description:
            "Update a position's name, description, permissions or scope. The same guardrails as creation apply — including for the position's EXISTING scope, so a group leader cannot edit a global position, and permission changes are limited to permissions the editor holds.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: positionSchema,
            description: "Position updated",
        })
        .badRequest({ description: "Invalid input" })
        .forbidden({ description: "Not authorized to update this position" })
        .notFound({ description: "Position not found" })
        .build(),
    requireAuth,
    validator("json", updatePositionSchema),
    async (c) => {
        const ctx = c.get("ctx");
        const { db } = ctx;
        const user = c.get("user");
        const groupSlug = c.req.param("groupSlug");
        const positionId = c.req.param("positionId");
        const body = c.req.valid("json");

        const position = await getPosition(ctx, positionId);
        if (!position || position.groupSlug !== groupSlug) {
            throw new HTTPException(404, { message: "Position not found" });
        }

        // The strictest of old and new scope decides who may touch this —
        // otherwise a leader could downgrade a global position (or an
        // upgrade could sneak past the roles:create requirement).
        const effectiveScope =
            position.scope === "global" || body.scope === "global"
                ? "global"
                : "group";

        if (
            !(await canManagePositions(ctx, user.id, groupSlug, effectiveScope))
        ) {
            throw new HTTPException(403, {
                message: "Not authorized to update this position",
            });
        }

        // Permission/scope changes re-run the grant guardrail on the FULL
        // resulting permission list at the resulting scope.
        const nextPermissions = body.permissions ?? position.permissions;
        const nextScope = body.scope ?? position.scope;
        if (
            !(await canGrantPositionPermissions(
                ctx,
                user.id,
                groupSlug,
                nextPermissions,
                nextScope,
            ))
        ) {
            throw new HTTPException(403, {
                message:
                    "You can only grant permissions you hold yourself at the position's scope",
            });
        }

        const [updated] = await db
            .update(schema.groupPosition)
            .set({
                ...(body.name !== undefined && { name: body.name }),
                ...(body.description !== undefined && {
                    description: body.description,
                }),
                ...(body.permissions !== undefined && {
                    permissions: body.permissions,
                }),
                ...(body.scope !== undefined && { scope: body.scope }),
            })
            .where(eq(schema.groupPosition.id, positionId))
            .returning();

        // A verv linked to a subgroup is the same grant as that subgroup's
        // org-wide leader permissions (see lib/group/linked-leader.ts) —
        // write both halves so the two admin pages stay in step.
        if (body.permissions !== undefined && updated) {
            await mirrorIntoLinkedGroup(ctx, updated, body.permissions);
        }

        const holder = await db.query.groupPositionHolder.findFirst({
            where: eq(schema.groupPositionHolder.positionId, positionId),
            with: {
                user: { columns: { id: true, name: true, image: true } },
            },
        });

        return c.json({
            ...updated,
            permissions: updated
                ? await readLinkedPositionPermissions(ctx, updated)
                : [],
            holder: holder
                ? {
                      userId: holder.user.id,
                      name: holder.user.name,
                      image: holder.user.image,
                  }
                : null,
        });
    },
);
