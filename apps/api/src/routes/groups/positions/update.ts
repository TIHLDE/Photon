import { isGroupScopablePermission } from "@photon/auth/rbac";
import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import {
    canGrantPositionPermissions,
    canManagePositions,
    getPosition,
} from "~/lib/group/positions";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { userImageExtra } from "~/lib/user/avatar";
import { requireAuth } from "~/middleware/auth";
import {
    GLOBAL_LIST_ON_GLOBAL_VERV,
    NOT_GROUP_SCOPABLE,
    positionSchema,
    updatePositionSchema,
} from "./schema";

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

        // Permission/scope changes re-run the grant guardrail on the resulting
        // permission list at the resulting scope.
        const nextPermissions = body.permissions ?? position.permissions;
        const nextScope = body.scope ?? position.scope;

        // Checked only when the list or scope changes, so renaming a verv that
        // predates the rule does not force a cleanup first.
        if (
            nextScope === "group" &&
            (body.permissions !== undefined || body.scope !== undefined)
        ) {
            const inert = nextPermissions.filter(
                (permission) => !isGroupScopablePermission(permission),
            );
            if (inert.length > 0) {
                throw new HTTPException(400, {
                    message: `${NOT_GROUP_SCOPABLE}: ${inert.join(", ")}`,
                });
            }
        }
        if (
            nextPermissions.length > 0 &&
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

        const nextGlobalPermissions =
            body.globalPermissions ?? position.globalPermissions;
        if (nextScope === "global" && nextGlobalPermissions.length > 0) {
            throw new HTTPException(400, {
                message: GLOBAL_LIST_ON_GLOBAL_VERV,
            });
        }
        const addedGlobal = nextGlobalPermissions.filter(
            (permission) => !position.globalPermissions.includes(permission),
        );
        if (
            addedGlobal.length > 0 &&
            !(await canGrantPositionPermissions(
                ctx,
                user.id,
                groupSlug,
                addedGlobal,
                "global",
            ))
        ) {
            throw new HTTPException(403, {
                message:
                    "You can only grant TIHLDE-wide permissions you hold globally yourself",
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
                ...(body.globalPermissions !== undefined && {
                    globalPermissions: body.globalPermissions,
                }),
            })
            .where(eq(schema.groupPosition.id, positionId))
            .returning();

        const holders = await db.query.groupPositionHolder.findMany({
            where: { positionId },
            with: {
                user: {
                    columns: { id: true, name: true },
                    extras: userImageExtra,
                },
            },
            orderBy: { createdAt: "asc" },
        });

        return c.json({
            ...updated,
            permissions: updated?.permissions ?? [],
            holders: holders.map((holder) => ({
                userId: holder.user.id,
                name: holder.user.name,
                image: holder.user.image,
            })),
        });
    },
);
