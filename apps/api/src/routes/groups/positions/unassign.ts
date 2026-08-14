import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { HS_GROUP_SLUG, pruneHsMembershipIfUnwarranted } from "~/lib/group";
import { canAssignPosition, getPosition } from "~/lib/group/positions";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { positionMessageSchema } from "./schema";

export const unassignPositionRoute = route().delete(
    "/:groupSlug/positions/:positionId/holders/:userId",
    describeRoute({
        tags: ["positions"],
        summary: "Remove a position from a user",
        operationId: "unassignGroupPosition",
        description:
            "Remove a position (verv) from a holder. Same authorization as assigning.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: positionMessageSchema,
            description: "Position removed from user",
        })
        .forbidden({ description: "Not authorized to manage this position" })
        .notFound({ description: "Position not found" })
        .response({
            statusCode: 409,
            description:
                "Position is managed automatically from group leadership",
        })
        .build(),
    requireAuth,
    async (c) => {
        const ctx = c.get("ctx");
        const { db } = ctx;
        const user = c.get("user");
        const groupSlug = c.req.param("groupSlug");
        const positionId = c.req.param("positionId");
        const targetUserId = c.req.param("userId");

        const position = await getPosition(ctx, positionId);
        if (!position || position.groupSlug !== groupSlug) {
            throw new HTTPException(404, { message: "Position not found" });
        }

        // Linked leader-verv follow the linked subgroup's leadership and are
        // synced automatically — they must never be unassigned by hand here.
        if (position.linkedGroupSlug) {
            throw new HTTPException(409, {
                message:
                    "This position is held automatically by the linked group's leader and cannot be changed manually. Change the group's leader on the group page instead.",
            });
        }

        if (!(await canAssignPosition(ctx, user.id, position))) {
            throw new HTTPException(403, {
                message: "Not authorized to manage this position",
            });
        }

        await db
            .delete(schema.groupPositionHolder)
            .where(
                and(
                    eq(schema.groupPositionHolder.positionId, positionId),
                    eq(schema.groupPositionHolder.userId, targetUserId),
                ),
            );

        // HS er AU + undergruppelederne. Mister du AU-vervet ditt, mister du
        // plassen med det — med mindre noe annet gir den (lederskapet i HS
        // eller i en undergruppe, eller et annet HS-verv).
        if (position.groupSlug === HS_GROUP_SLUG) {
            await pruneHsMembershipIfUnwarranted(ctx, targetUserId);
        }

        return c.json({ message: "Position removed from user" });
    },
);
