import { schema } from "@photon/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { requireEventAccess } from "~/lib/event/access";
import { createPaymentObligations } from "~/lib/event/payment";
import { env } from "~/lib/env";
import { createDeferredNotifications } from "~/lib/notification/deferred";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import {
    createRegistrationBodySchema,
    eventRegistrationResponseSchema,
} from "../schema";

export const adminCreateRegistrationRoute = route().post(
    "/:eventId/registration/:userId",
    describeRoute({
        tags: ["events"],
        summary: "Add a user to an event (admin)",
        operationId: "adminCreateEventRegistration",
        description:
            "Add a confirmed participant and include them in the event's priority-user list, including before registration opens or after it closes. Requires events:update or events:manage globally or for the arranging group. Bypasses self-registration eligibility and strike delays, but requires available capacity; pending registrations reserve capacity too. Payment obligations still apply. Events without sign-up, full events and existing active registrations are rejected. Cancelled registrations are reused.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: eventRegistrationResponseSchema,
            description: "OK",
        })
        .notFound({ description: "Event or user not found" })
        .forbidden({
            description: "Requires events:update or events:manage permission",
        })
        .response({
            statusCode: 409,
            description:
                "Event does not require sign-up, event is full, or user is already registered",
        })
        .build(),
    requireAuth,
    requireEventAccess({ permission: ["events:update", "events:manage"] }),
    validator("json", createRegistrationBodySchema),
    async (c) => {
        const eventId = c.req.param("eventId");
        const userId = c.req.param("userId");
        const ctx = c.get("ctx");
        const body = c.req.valid("json");
        const notifications = createDeferredNotifications();

        const registration = await ctx.db.transaction(async (tx) => {
            // Serialize capacity allocation with the resolver and waitlist promotion.
            const [event] = await tx
                .select()
                .from(schema.event)
                .where(eq(schema.event.id, eventId))
                .for("update");
            if (!event)
                throw new HTTPException(404, { message: "Event not found" });
            if (!event.requiresSigningUp) {
                throw new HTTPException(409, {
                    message: "Event does not require sign-up",
                });
            }
            const [user, existing, settings] = await Promise.all([
                tx.query.user.findFirst({
                    where: (u, { eq }) => eq(u.id, userId),
                    columns: { id: true },
                }),
                tx.query.eventRegistration.findFirst({
                    where: (r, { and, eq }) =>
                        and(eq(r.eventId, eventId), eq(r.userId, userId)),
                }),
                tx.query.userSettings.findFirst({
                    where: (s, { eq }) => eq(s.userId, userId),
                    columns: { allowsPhotosByDefault: true },
                }),
            ]);
            if (!user)
                throw new HTTPException(404, { message: "User not found" });
            if (existing && existing.status !== "cancelled") {
                throw new HTTPException(409, {
                    message: "User is already registered for this event",
                });
            }
            if (event.capacity !== null) {
                const occupied = await tx.$count(
                    schema.eventRegistration,
                    and(
                        eq(schema.eventRegistration.eventId, eventId),
                        inArray(schema.eventRegistration.status, [
                            "pending",
                            "registered",
                            "attended",
                            "no_show",
                        ]),
                    ),
                );
                if (occupied >= event.capacity) {
                    throw new HTTPException(409, { message: "Event is full" });
                }
            }

            const allowPhoto =
                body.allowPhoto ?? settings?.allowsPhotosByDefault ?? true;
            const [created] = await tx
                .insert(schema.eventRegistration)
                .values({
                    eventId,
                    userId,
                    status: "registered",
                    allowPhoto,
                })
                .onConflictDoUpdate({
                    target: [
                        schema.eventRegistration.userId,
                        schema.eventRegistration.eventId,
                    ],
                    set: {
                        status: "registered",
                        allowPhoto,
                        waitlistPosition: null,
                        attendedAt: null,
                        createdAt: sql`now()`,
                        updatedAt: sql`now()`,
                    },
                    setWhere: eq(schema.eventRegistration.status, "cancelled"),
                })
                .returning();
            if (!created) {
                throw new HTTPException(409, {
                    message: "User is already registered for this event",
                });
            }
            await tx
                .insert(schema.eventPriorityUser)
                .values({ eventId, userId })
                .onConflictDoNothing();
            await createPaymentObligations({ ...ctx, db: tx }, event, [userId]);
            notifications.add({
                userId,
                title: `Du er påmeldt ${event.title}!`,
                description: `Din påmelding til ${event.title} er bekreftet.`,
                link: `${env.WEBSITE_URL}/arrangementer/${event.slug}`,
                emailTemplate: {
                    name: "RegistrationConfirmedEmail",
                    props: {
                        eventName: event.title,
                        eventUrl: `${env.WEBSITE_URL}/arrangementer/${event.slug}`,
                        logoUrl: `${env.WEBSITE_URL}/logo512.png`,
                    },
                },
            });
            return created;
        });
        await notifications.flush(ctx);
        return c.json({
            eventId,
            userId,
            status: "registered" as const,
            createdAt: registration.createdAt.toISOString(),
            allowPhoto: registration.allowPhoto,
        });
    },
);
