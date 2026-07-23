import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { validator } from "hono-openapi";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { deleteMotetidEventResponseSchema, slugParamSchema } from "./schema";

export const deleteRoute = route().delete(
    "/events/:slug",
    describeRoute({
        tags: ["motetid"],
        summary: "Delete a scheduling event",
        operationId: "deleteMotetidEvent",
        description:
            "Delete a scheduling event you created. Participants and slots are removed with it.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: deleteMotetidEventResponseSchema,
            description: "Event deleted",
        })
        .notFound({ description: "Event not found" })
        .build(),
    requireAuth,
    validator("param", slugParamSchema),
    async (c) => {
        const { db } = c.get("ctx");
        const userId = c.get("user").id;
        const { slug } = c.req.valid("param");

        const event = await db.query.motetidEvent.findFirst({
            where: eq(schema.motetidEvent.slug, slug),
            columns: { id: true, createdById: true },
        });
        if (!event) {
            throw new HTTPException(404, { message: "Event not found" });
        }
        if (event.createdById !== userId) {
            throw new HTTPException(403, {
                message: "Du har ikke tilgang til å slette dette arrangementet",
            });
        }

        await db
            .delete(schema.motetidEvent)
            .where(eq(schema.motetidEvent.id, event.id));

        return c.json({ message: "Event deleted successfully" }, 200);
    },
);
