import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { canActOnEvent } from "~/lib/event/access";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import { deleteStrikeResponseSchema } from "./schema";

export const deleteStrikeRoute = route().delete(
    "/strikes/:strikeId",
    describeRoute({
        tags: ["strikes"],
        summary: "Delete strike",
        operationId: "deleteStrike",
        description:
            "Delete a strike (prikk) by its ID. Requires 'events:strikes:delete' or 'events:manage', globally or for the group arranging the strike's event.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: deleteStrikeResponseSchema,
            description: "Strike deleted successfully",
        })
        .forbidden({
            description:
                "Requires events:strikes:delete or events:manage permission",
        })
        .notFound({ description: "Strike not found" })
        .build(),
    requireAuth,
    // Coarse gate: the strike's event decides the scope, so the group-level
    // check happens in the handler once the strike is loaded.
    requireAccess({
        permission: ["events:strikes:delete", "events:manage"],
        anyGroupScope: true,
    }),
    async (c) => {
        const { strikeId } = c.req.param();
        const { db } = c.get("ctx");

        const strike = await db.query.eventStrike.findFirst({
            where: eq(schema.eventStrike.id, strikeId),
        });

        if (!strike) {
            throw new HTTPException(404, { message: "Strike not found" });
        }

        if (
            !(await canActOnEvent(
                c.get("ctx"),
                c.get("user").id,
                strike.eventId,
                ["events:strikes:delete", "events:manage"],
            ))
        ) {
            throw new HTTPException(403, {
                message:
                    "Forbidden - requires events:strikes:delete or events:manage for the group arranging this event",
            });
        }

        await db
            .delete(schema.eventStrike)
            .where(eq(schema.eventStrike.id, strikeId));

        return c.json({ message: "Strike deleted successfully" }, 200);
    },
);
