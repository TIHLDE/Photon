import { schema } from "@photon/db";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { describeRoute } from "~/lib/openapi";
import {
    getUserGroupSlugs,
    isUserPrioritized,
} from "../../../lib/event/priority";
import { getUserStrikeCount } from "../../../lib/event/strikes";
import { route } from "../../../lib/route";
import { requireAccess } from "../../../middleware/access";
import { requireAuth } from "../../../middleware/auth";
import {
    createRegistrationBodySchema,
    eventRegistrationResponseSchema,
} from "../schema";

export const registerToEventRoute = route().post(
    "/:eventId/registration",
    describeRoute({
        tags: ["events"],
        summary: "Register to an event",
        operationId: "createEventRegistration",
        description:
            "Create a new registration for the authenticated user to attend an event, initially with pending status. Requires the 'events:registrations:create' permission — granted by the member baseline role (active students), not by the alumni role.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: eventRegistrationResponseSchema,
            description: "OK",
        })
        .notFound({ description: "Event not found" })
        .forbidden({
            description:
                "Event only allows members covered by a priority pool to register",
        })
        .response({
            statusCode: 409,
            description:
                "Event is not open for registration or user already registered",
        })
        .build(),
    requireAuth,
    requireAccess({ permission: "events:registrations:create" }),
    validator("json", createRegistrationBodySchema),
    async (c) => {
        const now = new Date();
        const eventId = c.req.param("eventId");
        const userId = c.get("user").id;
        const { db } = c.get("ctx");
        const { allowPhoto } = c.req.valid("json");

        const event = await db.query.event.findFirst({
            where: (event, { eq }) => eq(event.id, eventId),
            with: {
                pools: {
                    with: {
                        groups: true,
                    },
                },
            },
        });

        if (!event) {
            throw new HTTPException(404, { message: "Event not found" });
        }

        if (event.isRegistrationClosed || !event.requiresSigningUp) {
            throw new HTTPException(409, {
                message: "Event is not open for registration",
            });
        }

        // Events with onlyAllowPrioritized reject non-prioritized users
        // outright at sign-up time, instead of waitlisting them.
        if (event.onlyAllowPrioritized) {
            const userGroupSlugs = await getUserGroupSlugs(userId, db);
            const strikeCount = await getUserStrikeCount(userId, db);

            const isPrioritized = isUserPrioritized({
                userGroupSlugs,
                eventPools: event.pools,
                strikeCount,
                enforcesPreviousStrikes: event.enforcesPreviousStrikes,
            });

            if (!isPrioritized) {
                throw new HTTPException(403, {
                    message:
                        "This event only allows members in a priority pool to register",
                });
            }
        }

        // Check if user is already registered
        const existingRegistration = await db.query.eventRegistration.findFirst(
            {
                where: (reg, { and, eq }) =>
                    and(eq(reg.eventId, eventId), eq(reg.userId, userId)),
            },
        );

        if (existingRegistration) {
            throw new HTTPException(409, {
                message: "User is already registered for this event",
            });
        }

        // Create pending registration in database
        await db.insert(schema.eventRegistration).values({
            eventId,
            userId,
            status: "pending",
            allowPhoto,
        });

        return c.json({
            eventId,
            userId,
            status: "pending" as const,
            createdAt: now.toISOString(),
            allowPhoto,
        });
    },
);
