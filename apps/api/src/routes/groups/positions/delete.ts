import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { canManagePositions, getPosition } from "~/lib/group/positions";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { positionMessageSchema } from "./schema";

export const deletePositionRoute = route().delete(
    "/:groupSlug/positions/:positionId",
    describeRoute({
        tags: ["positions"],
        summary: "Delete a position",
        operationId: "deleteGroupPosition",
        description:
            "Delete a position (verv). Holders lose the position's permissions. Deleting a global position requires 'roles:create'.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: positionMessageSchema,
            description: "Position deleted",
        })
        .forbidden({ description: "Not authorized to delete this position" })
        .notFound({ description: "Position not found" })
        .build(),
    requireAuth,
    async (c) => {
        const ctx = c.get("ctx");
        const { db } = ctx;
        const user = c.get("user");
        const groupSlug = c.req.param("groupSlug");
        const positionId = c.req.param("positionId");

        const position = await getPosition(ctx, positionId);
        if (!position || position.groupSlug !== groupSlug) {
            throw new HTTPException(404, { message: "Position not found" });
        }

        if (
            !(await canManagePositions(ctx, user.id, groupSlug, position.scope))
        ) {
            throw new HTTPException(403, {
                message: "Not authorized to delete this position",
            });
        }

        await db
            .delete(schema.groupPosition)
            .where(eq(schema.groupPosition.id, positionId));

        return c.json({ message: "Position deleted" });
    },
);
