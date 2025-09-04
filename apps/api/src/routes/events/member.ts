import { zValidator } from "@hono/zod-validator";
import {
    getEvents,
    getUserEventRegistration,
    registerForEvent,
    unregisterFromEvent,
} from "@photon/db/queries";
import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { HTTPException } from "hono/http-exception";
import { requireAuth } from "~/middleware/auth";
import { requirePermissions } from "~/middleware/permission";
import {
    ErrorResponseSchema,
    EventListResponseSchema,
    EventRegistrationWithUserSchema,
    EventsQuerySchema,
    RegisterForEventSchema,
    SuccessResponseSchema,
} from "~/schemas/events";

export const memberRoutes = new Hono()
    .get(
        "/me",
        describeRoute({
            summary: "Get my events",
            description:
                "Get events for the authenticated user (organized or registered)",
            responses: {
                200: {
                    description: "User events retrieved successfully",
                    content: {
                        "application/json": {
                            schema: resolver(EventListResponseSchema),
                        },
                    },
                },
            },
        }),
        requireAuth,
        requirePermissions("event.read"),
        zValidator("query", EventsQuerySchema),
        async (c) => {
            const query = c.req.valid("query");
            const user = c.get("user");

            const result = await getEvents({
                ...query,
                userId: user.id,
            });

            return c.json(result);
        },
    )
    .post(
        "/:id/register",
        describeRoute({
            summary: "Register for event",
            description: "Register the authenticated user for an event",
            responses: {
                200: {
                    description: "Successfully registered for event",
                    content: {
                        "application/json": {
                            schema: resolver(SuccessResponseSchema),
                        },
                    },
                },
                400: {
                    description: "Registration failed",
                    content: {
                        "application/json": {
                            schema: resolver(ErrorResponseSchema),
                        },
                    },
                },
                404: {
                    description: "Event not found",
                    content: {
                        "application/json": {
                            schema: resolver(ErrorResponseSchema),
                        },
                    },
                },
            },
        }),
        requireAuth,
        requirePermissions("event.read"),
        zValidator("json", RegisterForEventSchema),
        async (c) => {
            const eventId = c.req.param("id");
            const { notes } = c.req.valid("json");
            const user = c.get("user");

            try {
                const registration = await registerForEvent(
                    eventId,
                    user.id,
                    notes,
                );

                const message =
                    registration.status === "WAITLISTED"
                        ? "You have been added to the waitlist for this event"
                        : "You have been successfully registered for this event";

                return c.json({ message });
            } catch (error) {
                if (error instanceof Error) {
                    throw new HTTPException(400, { message: error.message });
                }
                throw new HTTPException(500, {
                    message: "Registration failed",
                });
            }
        },
    )
    .delete(
        "/:id/register",
        describeRoute({
            summary: "Unregister from event",
            description:
                "Remove the authenticated user's registration from an event",
            responses: {
                200: {
                    description: "Successfully unregistered from event",
                    content: {
                        "application/json": {
                            schema: resolver(SuccessResponseSchema),
                        },
                    },
                },
                400: {
                    description: "Unregistration failed",
                    content: {
                        "application/json": {
                            schema: resolver(ErrorResponseSchema),
                        },
                    },
                },
            },
        }),
        requireAuth,
        requirePermissions("event.read"),
        async (c) => {
            const eventId = c.req.param("id");
            const user = c.get("user");

            try {
                await unregisterFromEvent(eventId, user.id);
                return c.json({
                    message: "Successfully unregistered from event",
                });
            } catch (error) {
                if (error instanceof Error) {
                    throw new HTTPException(400, { message: error.message });
                }
                throw new HTTPException(500, {
                    message: "Unregistration failed",
                });
            }
        },
    )
    .get(
        "/:id/registration",
        describeRoute({
            summary: "Get my registration status",
            description:
                "Get the authenticated user's registration status for an event",
            responses: {
                200: {
                    description: "Registration status retrieved successfully",
                    content: {
                        "application/json": {
                            schema: resolver(
                                EventRegistrationWithUserSchema.nullable(),
                            ),
                        },
                    },
                },
            },
        }),
        requireAuth,
        requirePermissions("event.read"),
        async (c) => {
            const eventId = c.req.param("id");
            const user = c.get("user");

            const registration = await getUserEventRegistration(
                eventId,
                user.id,
            );
            return c.json(registration);
        },
    );
