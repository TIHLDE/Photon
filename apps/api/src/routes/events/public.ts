import { zValidator } from "@hono/zod-validator";
import { getEventById, getEvents } from "@photon/db/queries";
import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { HTTPException } from "hono/http-exception";
import { session } from "~/middleware/session";
import {
    ErrorResponseSchema,
    EventListResponseSchema,
    EventsQuerySchema,
    EventWithStatsSchema,
} from "~/schemas/events";

export const publicRoutes = new Hono()
    .get(
        "/",
        describeRoute({
            summary: "Get all events",
            description: "Retrieve a paginated list of published events",
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
        zValidator("query", EventsQuerySchema),
        async (c) => {
            const query = c.req.valid("query");

            const result = await getEvents({
                ...query,
                status: "PUBLISHED",
            });

            return c.json(result);
        },
    )
    .get(
        "/:id",
        describeRoute({
            summary: "Get event by ID",
            description: "Retrieve a single event by its ID",
            responses: {
                200: {
                    description: "Event retrieved successfully",
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
        session,
        async (c) => {
            const id = c.req.param("id");
            const user = c.get("user");

            const event = await getEventById(id, user?.id);

            if (!event) {
                throw new HTTPException(404, { message: "Event not found" });
            }

            if (!user && event.status !== "PUBLISHED") {
                throw new HTTPException(404, { message: "Event not found" });
            }

            return c.json(event);
        },
    );
