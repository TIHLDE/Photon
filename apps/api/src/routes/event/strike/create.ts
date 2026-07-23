import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import type z from "zod";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import { createStrikeSchema, strikeSchema } from "./schema";

export const createStrikeRoute = route().post(
    "/strikes",
    describeRoute({
        tags: ["strikes"],
        summary: "Create strike",
        operationId: "createStrike",
        description:
            "Give a user a strike (prikk) connected to an event. Requires 'events:strikes:create' or 'events:manage' permission.",
    })
        .schemaResponse({
            statusCode: 201,
            schema: strikeSchema,
            description: "Strike created successfully",
        })
        .forbidden({
            description:
                "Requires events:strikes:create or events:manage permission",
        })
        .notFound({ description: "User or event not found" })
        .build(),
    requireAuth,
    requireAccess({ permission: ["events:strikes:create", "events:manage"] }),
    validator("json", createStrikeSchema),
    async (c) => {
        const body = c.req.valid("json");
        const { db } = c.get("ctx");

        const targetUser = await db.query.user.findFirst({
            columns: { id: true, name: true, image: true },
            where: eq(schema.user.id, body.userId),
        });

        if (!targetUser) {
            throw new HTTPException(404, {
                message: `User with ID "${body.userId}" not found`,
            });
        }

        const targetEvent = await db.query.event.findFirst({
            columns: { id: true, title: true },
            where: eq(schema.event.id, body.eventId),
        });

        if (!targetEvent) {
            throw new HTTPException(404, {
                message: `Event with ID "${body.eventId}" not found`,
            });
        }

        const [newStrike] = await db
            .insert(schema.eventStrike)
            .values({
                userId: body.userId,
                eventId: body.eventId,
                count: body.count,
                reason: body.reason,
            })
            .returning();

        if (!newStrike) {
            throw new HTTPException(500, {
                message: "Failed to create strike",
            });
        }

        return c.json(
            {
                id: newStrike.id,
                userId: newStrike.userId,
                eventId: newStrike.eventId,
                count: newStrike.count,
                reason: newStrike.reason,
                createdAt: newStrike.createdAt.toISOString(),
                user: targetUser,
                event: targetEvent,
            } satisfies z.infer<typeof strikeSchema>,
            201,
        );
    },
);
