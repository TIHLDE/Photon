import { schema } from "@photon/db";
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
            "Assign a position (verv) to a group member. The assigner must be able to manage the position AND hold all its permissions — you cannot hand out a title you could not have created (prevents e.g. assigning the root title without holding root).",
    })
        .schemaResponse({
            statusCode: 200,
            schema: positionMessageSchema,
            description: "Position assigned",
        })
        .badRequest({ description: "User is not a member of the group" })
        .forbidden({ description: "Not authorized to assign this position" })
        .notFound({ description: "Position not found" })
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

        await db
            .insert(schema.groupPositionHolder)
            .values({
                positionId,
                userId: body.userId,
                grantedBy: user.id,
            })
            .onConflictDoNothing();

        return c.json({ message: "Position assigned" });
    },
);
