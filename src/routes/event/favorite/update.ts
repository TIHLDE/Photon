import { and, eq } from "drizzle-orm";
import { describeRoute, resolver, validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import z from "zod";
import { schema } from "~/db";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";

const updateFavoriteSchema = z.object({
    isFavorite: z.boolean().meta({ description: "Is favorite" }),
});

const updateBodySchemaOpenAPI =
    await resolver(updateFavoriteSchema).toOpenAPISchema();

export const updateFavoriteRoute = route().put(
    "/:id",
    describeRoute({
        tags: ["events"],
        summary: "Update event favorite",
        requestBody: {
            content: {
                "application/json": { schema: updateBodySchemaOpenAPI.schema },
            },
        },
        responses: {
            200: {
                description: "Updated",
            },
            404: {
                description: "Not found",
            },
        },
    }),
    requireAuth,
    // requirePermissions("events:create"),
    validator("json", updateFavoriteSchema),
    async (c) => {
        const body = c.req.valid("json");
        const userId = c.get("user").id;
        const eventId = c.req.param("id");
        const { db } = c.get("ctx");

        if (!eventId) {
            throw new HTTPException(400, { message: "Event ID is required" });
        }

        const [event] = await db
            .select()
            .from(schema.event)
            .where(eq(schema.event.id, eventId))
            .limit(1);

        if (!event) {
            throw new HTTPException(404, { message: "Event not found" });
        }

        if (body.isFavorite) {
            // Add to favorites
            await db.insert(schema.eventFavorite).values({
                eventId,
                userId,
            });
        } else {
            // Remove from favorites
            await db
                .delete(schema.eventFavorite)
                .where(
                    and(
                        eq(schema.eventFavorite.eventId, eventId),
                        eq(schema.eventFavorite.userId, userId),
                    ),
                );
        }

        return c.json({ success: true }, 200);
    },
);
