import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
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
            "Delete a strike (prikk) by its ID. Requires 'events:strikes:delete' or 'events:manage' permission.",
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
    requireAccess({ permission: ["events:strikes:delete", "events:manage"] }),
    async (c) => {
        const { strikeId } = c.req.param();
        const { db } = c.get("ctx");

        const strike = await db.query.eventStrike.findFirst({
            where: eq(schema.eventStrike.id, strikeId),
        });

        if (!strike) {
            throw new HTTPException(404, { message: "Strike not found" });
        }

        await db
            .delete(schema.eventStrike)
            .where(eq(schema.eventStrike.id, strikeId));

        return c.json({ message: "Strike deleted successfully" }, 200);
    },
);
