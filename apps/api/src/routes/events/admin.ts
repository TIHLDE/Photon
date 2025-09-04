import { zValidator } from "@hono/zod-validator";
import {
    createEvent,
    deleteEvent,
    getEventById,
    getEventRegistrations,
    getEvents,
    getEventWaitlist,
    moveFromWaitlistToRegistered,
    updateEvent,
} from "@photon/db/queries";
import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { HTTPException } from "hono/http-exception";
import { requireAuth } from "~/middleware/auth";
import { requirePermissions } from "~/middleware/permission";
import {
    CreateEventSchema,
    ErrorResponseSchema,
    EventListResponseSchema,
    EventRegistrationWithUserSchema,
    EventsQuerySchema,
    EventWithStatsSchema,
    MoveFromWaitlistSchema,
    SuccessResponseSchema,
    UpdateEventSchema,
} from "~/schemas/events";

export const adminRoutes = new Hono()
    .get(
        "/admin",
        describeRoute({
            summary: "Get all events (admin)",
            description:
                "Retrieve all events including drafts and cancelled events",
            responses: {
                200: {
                    description: "Events retrieved successfully",
                    content: {
                        "application/json": {
                            schema: resolver(EventListResponseSchema),
                        },
                    },
                },
            },
        }),
        requireAuth,
        requirePermissions("event.write", "event.read"),
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
        "/",
        describeRoute({
            summary: "Create event",
            description: "Create a new event",
            responses: {
                201: {
                    description: "Event created successfully",
                    content: {
                        "application/json": {
                            schema: resolver(EventWithStatsSchema),
                        },
                    },
                },
                400: {
                    description: "Invalid event data",
                    content: {
                        "application/json": {
                            schema: resolver(ErrorResponseSchema),
                        },
                    },
                },
            },
        }),
        requireAuth,
        requirePermissions("event.write"),
        zValidator("json", CreateEventSchema),
        async (c) => {
            const data = c.req.valid("json");
            const user = c.get("user");

            try {
                const event = await createEvent({
                    ...data,
                    startDate: new Date(data.startDate),
                    endDate: data.endDate ? new Date(data.endDate) : undefined,
                    registrationStart: data.registrationStart
                        ? new Date(data.registrationStart)
                        : undefined,
                    registrationEnd: data.registrationEnd
                        ? new Date(data.registrationEnd)
                        : undefined,
                    organizerId: user.id,
                });

                return c.json(event, 201);
            } catch (error) {
                throw new HTTPException(400, {
                    message: "Failed to create event",
                });
            }
        },
    )
    .put(
        "/:id",
        describeRoute({
            summary: "Update event",
            description: "Update an existing event",
            responses: {
                200: {
                    description: "Event updated successfully",
                    content: {
                        "application/json": {
                            schema: resolver(EventWithStatsSchema),
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
        requirePermissions("event.write"),
        zValidator("json", UpdateEventSchema),
        async (c) => {
            const id = c.req.param("id");
            const data = c.req.valid("json");
            const user = c.get("user");

            try {
                // Check if event exists and user has permission to edit
                const existingEvent = await getEventById(id);
                if (!existingEvent) {
                    throw new HTTPException(404, {
                        message: "Event not found",
                    });
                }

                // Only the organizer or someone with admin permissions can edit
                const hasAdminPermission = true; // You might want to check for admin.full_access permission here
                if (
                    existingEvent.organizerId !== user.id &&
                    !hasAdminPermission
                ) {
                    throw new HTTPException(403, {
                        message: "You can only edit your own events",
                    });
                }

                const updateData: any = { ...data };
                if (data.startDate)
                    updateData.startDate = new Date(data.startDate);
                if (data.endDate) updateData.endDate = new Date(data.endDate);
                if (data.registrationStart)
                    updateData.registrationStart = new Date(
                        data.registrationStart,
                    );
                if (data.registrationEnd)
                    updateData.registrationEnd = new Date(data.registrationEnd);

                const event = await updateEvent(id, updateData);
                return c.json(event);
            } catch (error) {
                if (error instanceof HTTPException) throw error;
                throw new HTTPException(400, {
                    message: "Failed to update event",
                });
            }
        },
    )
    .delete(
        "/:id",
        describeRoute({
            summary: "Delete event",
            description: "Delete an event",
            responses: {
                200: {
                    description: "Event deleted successfully",
                    content: {
                        "application/json": {
                            schema: resolver(SuccessResponseSchema),
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
        requirePermissions("event.delete"),
        async (c) => {
            const id = c.req.param("id");
            const user = c.get("user");

            try {
                // Check if event exists and user has permission to delete
                const existingEvent = await getEventById(id);
                if (!existingEvent) {
                    throw new HTTPException(404, {
                        message: "Event not found",
                    });
                }

                // Only the organizer or someone with admin permissions can delete
                const hasAdminPermission = true; // You might want to check for admin.full_access permission here
                if (
                    existingEvent.organizerId !== user.id &&
                    !hasAdminPermission
                ) {
                    throw new HTTPException(403, {
                        message: "You can only delete your own events",
                    });
                }

                await deleteEvent(id);
                return c.json({ message: "Event deleted successfully" });
            } catch (error) {
                if (error instanceof HTTPException) throw error;
                throw new HTTPException(400, {
                    message: "Failed to delete event",
                });
            }
        },
    )
    .get(
        "/:id/registrations",
        describeRoute({
            summary: "Get event registrations",
            description: "Get all registrations for an event",
            responses: {
                200: {
                    description: "Registrations retrieved successfully",
                    content: {
                        "application/json": {
                            schema: resolver(
                                EventRegistrationWithUserSchema.array(),
                            ),
                        },
                    },
                },
            },
        }),
        requireAuth,
        requirePermissions("event.manage_registrations"),
        async (c) => {
            const eventId = c.req.param("id");

            const registrations = await getEventRegistrations(eventId);
            return c.json(registrations);
        },
    )
    .get(
        "/:id/waitlist",
        describeRoute({
            summary: "Get event waitlist",
            description: "Get the waitlist for an event",
            responses: {
                200: {
                    description: "Waitlist retrieved successfully",
                    content: {
                        "application/json": {
                            schema: resolver(
                                EventRegistrationWithUserSchema.array(),
                            ),
                        },
                    },
                },
            },
        }),
        requireAuth,
        requirePermissions("event.manage_registrations"),
        async (c) => {
            const eventId = c.req.param("id");

            const waitlist = await getEventWaitlist(eventId);
            return c.json(waitlist);
        },
    )
    .post(
        "/:id/move-from-waitlist",
        describeRoute({
            summary: "Move user from waitlist to registered",
            description: "Move a user from the waitlist to registered status",
            responses: {
                200: {
                    description: "User moved from waitlist successfully",
                    content: {
                        "application/json": {
                            schema: resolver(EventRegistrationWithUserSchema),
                        },
                    },
                },
                400: {
                    description: "Failed to move user from waitlist",
                    content: {
                        "application/json": {
                            schema: resolver(ErrorResponseSchema),
                        },
                    },
                },
            },
        }),
        requireAuth,
        requirePermissions("event.manage_registrations"),
        zValidator("json", MoveFromWaitlistSchema),
        async (c) => {
            const eventId = c.req.param("id");
            const { userId } = c.req.valid("json");

            try {
                const registration = await moveFromWaitlistToRegistered(
                    eventId,
                    userId,
                );
                return c.json(registration);
            } catch (error) {
                if (error instanceof Error) {
                    throw new HTTPException(400, { message: error.message });
                }
                throw new HTTPException(500, {
                    message: "Failed to move user from waitlist",
                });
            }
        },
    );
