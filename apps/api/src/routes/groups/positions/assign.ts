import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { isGroupMember } from "~/lib/group";
import { canAssignPosition, getPosition } from "~/lib/group/positions";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { assignPositionSchema, positionMessageSchema } from "./schema";

export const assignPositionRoute = route().post(
    "/:groupSlug/positions/:positionId/holders",
    describeRoute({
        tags: ["positions"],
        summary: "Assign a position to a user",
        operationId: "assignGroupPosition",
        description:
            "Assign a position (verv) to a group member. A position can be held by at most ONE user — assigning an occupied position fails; unassign the current holder first (or create a second position for a second holder). The assigner must be able to manage the position AND hold all its permissions — you cannot hand out a title you could not have created (prevents e.g. assigning the root title without holding root).",
    })
        .schemaResponse({
            statusCode: 200,
            schema: positionMessageSchema,
            description: "Position assigned",
        })
        .badRequest({ description: "User is not a member of the group" })
        .forbidden({ description: "Not authorized to assign this position" })
        .notFound({ description: "Position not found" })
        .response({
            statusCode: 409,
            description: "Position already has a holder",
        })
        .build(),
    requireAuth,
    validator("json", assignPositionSchema),
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

        if (!(await canAssignPosition(ctx, user.id, position))) {
            throw new HTTPException(403, {
                message: "Not authorized to assign this position",
            });
        }

        if (!(await isGroupMember(ctx, body.userId, groupSlug))) {
            throw new HTTPException(400, {
                message:
                    "User must be a member of the group to hold a position",
            });
        }

        // A position has at most one holder. Re-assigning to the same user
        // is idempotent; anyone else must unassign the current holder first.
        const [existing] = await db
            .select({ userId: schema.groupPositionHolder.userId })
            .from(schema.groupPositionHolder)
            .where(eq(schema.groupPositionHolder.positionId, positionId))
            .limit(1);

        if (existing && existing.userId !== body.userId) {
            throw new HTTPException(409, {
                message:
                    "Position already has a holder. Unassign the current holder first, or create a separate position.",
            });
        }

        if (!existing) {
            await db.insert(schema.groupPositionHolder).values({
                positionId,
                userId: body.userId,
                grantedBy: user.id,
            });
        }

        return c.json({ message: "Position assigned" });
    },
);
