import { schema } from "@photon/db";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { describeRoute } from "~/lib/openapi";
import {
    getUserInstituteIds,
    isUserInInstitute,
} from "../../../lib/event/institute";
import {
    getUserGroupSlugs,
    isUserPrioritized,
} from "../../../lib/event/priority";
import { getUserStrikeCount } from "../../../lib/event/strikes";
import { route } from "../../../lib/route";
import { hasAcceptedEventRules } from "../../../lib/user/settings";
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
                "User has not accepted the event rules, or the event only allows members covered by a priority pool or members of a specific institute to register",
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
                restrictedToInstitute: true,
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

        // Checked before every event-specific rule so the message a member
        // gets is the one thing they can act on. The frontend shows the same
        // block ahead of time — hitting it here means they went around it.
        if (!(await hasAcceptedEventRules(userId, c.get("ctx")))) {
            throw new HTTPException(403, {
                message:
                    "You must accept the event rules before registering for events",
            });
        }

        // Events tied to one institute reject everyone outside it, so a
        // DigSec (IIK) student cannot take an IDI seat, or the other way
        // around.
        if (event.restrictedToInstituteId !== null) {
            const userInstituteIds = await getUserInstituteIds(userId, db);

            if (
                !isUserInInstitute(
                    event.restrictedToInstituteId,
                    userInstituteIds,
                )
            ) {
                const shortName =
                    event.restrictedToInstitute?.shortName ?? "instituttet";
                throw new HTTPException(403, {
                    message: `This event is only open to students at ${shortName}`,
                });
            }
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
