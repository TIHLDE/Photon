import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import type z from "zod";
import { canActOnEvent, strikePermissions } from "~/lib/event/access";
import { wasPromotedAfterStart } from "~/lib/event/strikes";
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
            "Give a user a strike (prikk) connected to an event. Requires 'events:strikes:create', or the right to arrange the event ('events:update' / 'events:manage') — globally or for the group arranging it.",
    })
        .schemaResponse({
            statusCode: 201,
            schema: strikeSchema,
            description: "Strike created successfully",
        })
        .forbidden({
            description:
                "Requires events:strikes:create, or the right to arrange the event",
        })
        .notFound({ description: "User or event not found" })
        .response({
            statusCode: 409,
            description:
                "The user was promoted from the waitlist after the event started",
        })
        .build(),
    requireAuth,
    // Coarse gate: the event — and with it the scope — is named in the body,
    // so the group-level check happens in the handler once it is resolved.
    requireAccess({
        permission: strikePermissions("create"),
        anyGroupScope: true,
    }),
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
            columns: { id: true, title: true, slug: true, start: true },
            where: eq(schema.event.id, body.eventId),
        });

        if (!targetEvent) {
            throw new HTTPException(404, {
                message: `Event with ID "${body.eventId}" not found`,
            });
        }

        if (
            !(await canActOnEvent(
                c.get("ctx"),
                c.get("user").id,
                body.eventId,
                strikePermissions("create"),
            ))
        ) {
            throw new HTTPException(403, {
                message:
                    "Forbidden - requires events:strikes:create, or the right to arrange events for the group behind this event",
            });
        }

        const registration = await db.query.eventRegistration.findFirst({
            columns: { promotedFromWaitlistAt: true },
            where: and(
                eq(schema.eventRegistration.userId, body.userId),
                eq(schema.eventRegistration.eventId, body.eventId),
            ),
        });

        if (
            registration &&
            wasPromotedAfterStart(
                registration.promotedFromWaitlistAt,
                targetEvent.start,
            )
        ) {
            throw new HTTPException(409, {
                message:
                    "Medlemmet rykket opp fra ventelisten etter at arrangementet startet, og kan ikke få prikk for det.",
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
                event: {
                    id: targetEvent.id,
                    title: targetEvent.title,
                    slug: targetEvent.slug,
                },
            } satisfies z.infer<typeof strikeSchema>,
            201,
        );
    },
);
