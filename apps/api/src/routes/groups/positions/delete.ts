import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { HS_GROUP_SLUG, pruneHsMembershipIfUnwarranted } from "~/lib/group";
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
            "Delete a position (verv). Holders lose the position's permissions. Deleting an HS position also takes the holder's seat in HS unless something else warrants it. Deleting a global position requires 'roles:create'.",
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

        // Holderen leses før slettingen: holder-raden kaskaderer bort med
        // vervet, og prunen må uansett kjøre etterpå — ellers ser den vervet
        // den nettopp mistet som grunn til å bli sittende.
        const holders = await db
            .select({ userId: schema.groupPositionHolder.userId })
            .from(schema.groupPositionHolder)
            .where(eq(schema.groupPositionHolder.positionId, positionId));

        await db
            .delete(schema.groupPosition)
            .where(eq(schema.groupPosition.id, positionId));

        // Legges vervet ned, forsvinner grunnen til å sitte i HS med det —
        // med mindre noe annet gir plassen (lederskap i HS eller i en
        // undergruppe, eller et annet HS-verv).
        if (position.groupSlug === HS_GROUP_SLUG) {
            for (const { userId } of holders) {
                await pruneHsMembershipIfUnwarranted(ctx, userId);
            }
        }

        return c.json({ message: "Position deleted" });
    },
);
