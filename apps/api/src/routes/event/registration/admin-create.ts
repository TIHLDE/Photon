import { schema } from "@photon/db";
import { eq, sql } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { enqueueRegistrationResolve } from "~/lib/event/resolve-queue";
import { requireEventAccess } from "~/lib/event/access";
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
            "Add a user on their behalf, including before registration opens or after it closes. Requires 'events:update' or 'events:manage', globally or for the arranging group. Bypasses registration timing (including strike delays), closed registration, event-rule acceptance, unanswered evaluations, institute and priority eligibility, and the user's events:registrations:create permission. Capacity, priority ordering, waitlist settings and payment obligations still apply. Events without sign-up and existing active registrations are rejected; cancelled registrations are reused. Returns pending while the background resolver allocates the place.",
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
                "Event does not require sign-up, or the user is already registered",
        })
        .build(),
    requireAuth,
    requireEventAccess({ permission: ["events:update", "events:manage"] }),
    validator("json", createRegistrationBodySchema),
    async (c) => {
        const eventId = c.req.param("eventId");
        const userId = c.req.param("userId");
        const ctx = c.get("ctx");
        const { db } = ctx;
        const body = c.req.valid("json");

        const [event, user, existingRegistration, userSettings] =
            await Promise.all([
                db.query.event.findFirst({
                    where: (event, { eq }) => eq(event.id, eventId),
                }),
                db.query.user.findFirst({
                    where: (user, { eq }) => eq(user.id, userId),
                    columns: { id: true },
                }),
                db.query.eventRegistration.findFirst({
                    where: (reg, { and, eq }) =>
                        and(eq(reg.eventId, eventId), eq(reg.userId, userId)),
                }),
                // Bare nødvendig når kallet ikke sier noe om bildesamtykke selv.
                body.allowPhoto === undefined
                    ? db.query.userSettings.findFirst({
                          where: (settings, { eq }) =>
                              eq(settings.userId, userId),
                          columns: { allowsPhotosByDefault: true },
                      })
                    : undefined,
            ]);

        if (!event) {
            throw new HTTPException(404, { message: "Event not found" });
        }
        if (!user) {
            throw new HTTPException(404, { message: "User not found" });
        }

        // Uten påmelding finnes ikke plassen å tvinge noen inn på: et
        // arrangement uten påmelding er åpent for alle som møter opp.
        if (!event.requiresSigningUp) {
            throw new HTTPException(409, {
                message: "Event does not require sign-up",
            });
        }

        // En kansellert rad er ikke en påmelding — den kan gjenbrukes. Se
        // registration/create.ts.
        if (
            existingRegistration &&
            existingRegistration.status !== "cancelled"
        ) {
            throw new HTTPException(409, {
                message: "User is already registered for this event",
            });
        }

        const allowPhoto =
            body.allowPhoto ?? userSettings?.allowsPhotosByDefault ?? true;

        // Samme rad og samme klokke som en vanlig påmelding: resolveren
        // køordner på `createdAt` og avgjør plassen — gitt hvis det er rom,
        // venteliste hvis ikke. Arrangøren tvinger ingen forbi køen.
        const [registration] = await db
            .insert(schema.eventRegistration)
            .values({
                eventId,
                userId,
                status: "pending",
                addedByOrganizer: true,
                allowPhoto,
            })
            .onConflictDoUpdate({
                target: [
                    schema.eventRegistration.userId,
                    schema.eventRegistration.eventId,
                ],
                set: {
                    status: "pending",
                    addedByOrganizer: true,
                    allowPhoto,
                    waitlistPosition: null,
                    attendedAt: null,
                    createdAt: sql`now()`,
                    updatedAt: sql`now()`,
                },
                setWhere: eq(schema.eventRegistration.status, "cancelled"),
            })
            .returning();

        if (!registration) {
            throw new HTTPException(409, {
                message: "User is already registered for this event",
            });
        }

        await enqueueRegistrationResolve(eventId, ctx);

        return c.json({
            eventId,
            userId,
            status: "pending" as const,
            createdAt: registration.createdAt.toISOString(),
            allowPhoto,
        });
    },
);
