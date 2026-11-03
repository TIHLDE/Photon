import { hasPermission } from "@photon/auth/rbac";
import { schema } from "@photon/db";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import type z from "zod";
import {
    DEFAULT_STATUSES,
    canActOnEvent,
    strikePermissions,
} from "~/lib/event/access";
import { wasPromotedAfterStart } from "~/lib/event/strikes";
import { sendNotification } from "~/lib/notification";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { userImageExtra } from "~/lib/user/avatar";
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
            "Give a user a strike (prikk) connected to an event, and notify them. Requires 'events:strikes:create', or the right to arrange the event ('events:update' / 'events:manage') — globally or for the group arranging it. Unless the caller holds 'events:strikes:create' across TIHLDE, the user must have signed up and held a spot on the event, or already have a strike from it (leaving after the deadline removes the registration but leaves the automatic strike).",
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
                "The user was promoted from the waitlist after the event started, or has no registration of their own on the event",
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
        const ctx = c.get("ctx");
        const { db } = ctx;
        const callerId = c.get("user").id;

        const targetUser = await db.query.user.findFirst({
            columns: { id: true, name: true },
            extras: userImageExtra,
            where: { id: body.userId },
        });

        if (!targetUser) {
            throw new HTTPException(404, {
                message: `User with ID "${body.userId}" not found`,
            });
        }

        const targetEvent = await db.query.event.findFirst({
            columns: { id: true, title: true, slug: true, start: true },
            where: { id: body.eventId },
        });

        if (!targetEvent) {
            throw new HTTPException(404, {
                message: `Event with ID "${body.eventId}" not found`,
            });
        }

        if (
            !(await canActOnEvent(
                ctx,
                callerId,
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
            columns: {
                status: true,
                addedByOrganizer: true,
                promotedFromWaitlistAt: true,
            },
            where: { userId: body.userId, eventId: body.eventId },
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

        const hasHeldOwnSpot = registration
            ? !registration.addedByOrganizer &&
              DEFAULT_STATUSES.some((status) => status === registration.status)
            : Boolean(
                  await db.query.eventStrike.findFirst({
                      columns: { id: true },
                      where: { userId: body.userId, eventId: body.eventId },
                  }),
              );

        if (
            !hasHeldOwnSpot &&
            !(await hasPermission(ctx, callerId, "events:strikes:create"))
        ) {
            throw new HTTPException(409, {
                message:
                    "Medlemmet har ikke meldt seg på dette arrangementet selv, og kan derfor ikke få prikk av arrangøren.",
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

        try {
            await sendNotification(
                {
                    userId: body.userId,
                    title:
                        body.count === 1
                            ? "Du har fått 1 prikk"
                            : `Du har fått ${body.count} prikker`,
                    description: body.reason
                        ? `${targetEvent.title}: ${body.reason}`
                        : targetEvent.title,
                    link: `/profil/${body.userId}/prikker`,
                },
                ctx,
            );
        } catch (error) {
            c.get("logger")?.error(
                { err: error, strikeId: newStrike.id },
                "Failed to send strike notification",
            );
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
