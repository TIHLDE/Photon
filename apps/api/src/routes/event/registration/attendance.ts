import { schema } from "@photon/db";
import type { RegistrationStatus } from "@photon/db/schema";
import { and, eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import type z from "zod";
import zod from "zod";
import { requireEventAccess } from "~/lib/event/access";
import { Schema, describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";

/**
 * Only these statuses hold an actual spot on the event. Anyone else — the
 * waitlist, a cancelled spot, an unresolved registration — cannot be checked
 * in: they do not have access to the event.
 */
const CHECK_IN_STATUSES: readonly RegistrationStatus[] = [
    "registered",
    "attended",
    "no_show",
];

const setAttendanceSchema = Schema(
    "SetAttendance",
    zod.object({
        attended: zod.boolean().meta({
            description:
                "True marks the user as attended (checked in); false reverts them to registered.",
        }),
    }),
);

const attendanceResponseSchema = Schema(
    "Attendance",
    zod.object({
        userId: zod.string(),
        eventId: zod.string(),
        // Returned so a check-in scanner can name the person it just checked
        // in without looking them up in the (paginated) participant list.
        name: zod.string(),
        status: zod.string().meta({ description: "New registration status" }),
        attendedAt: zod.string().nullable(),
    }),
);

export const setAttendanceRoute = route().patch(
    "/:eventId/registration/:userId/attendance",
    describeRoute({
        tags: ["events"],
        summary: "Set registration attendance",
        operationId: "setRegistrationAttendance",
        description:
            "Mark a registered user as attended (checked in) or revert them to registered. Used for event check-in; users left as 'registered' after the event may receive no-show strikes. Requires 'events:update' or 'events:manage', globally or for the arranging group.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: attendanceResponseSchema,
            description: "OK",
        })
        .forbidden({
            description: "Requires events:update or events:manage permission",
        })
        .notFound({ description: "Registration not found" })
        .response({
            statusCode: 409,
            description:
                "Conflict - the user does not hold a spot on the event (waitlisted, cancelled or pending)",
        })
        .build(),
    requireAuth,
    requireEventAccess({ permission: ["events:update", "events:manage"] }),
    validator("json", setAttendanceSchema),
    async (c) => {
        const { db } = c.get("ctx");
        const eventId = c.req.param("eventId");
        const userId = c.req.param("userId");
        const { attended } = c.req.valid("json");

        const registration = await db.query.eventRegistration.findFirst({
            where: and(
                eq(schema.eventRegistration.userId, userId),
                eq(schema.eventRegistration.eventId, eventId),
            ),
            with: { user: { columns: { name: true } } },
        });

        if (!registration) {
            throw new HTTPException(404, {
                message: "Registration not found",
            });
        }

        // Separate from the 404 on purpose: «not registered» and «on the
        // waitlist» are different answers for whoever is scanning at the door.
        if (!CHECK_IN_STATUSES.includes(registration.status)) {
            throw new HTTPException(409, {
                message:
                    registration.status === "waitlisted"
                        ? "User is on the waitlist and does not have a spot on this event"
                        : "User does not have a spot on this event",
            });
        }

        const [updated] = await db
            .update(schema.eventRegistration)
            .set({
                status: attended ? "attended" : "registered",
                attendedAt: attended ? new Date() : null,
            })
            .where(
                and(
                    eq(schema.eventRegistration.userId, userId),
                    eq(schema.eventRegistration.eventId, eventId),
                ),
            )
            .returning();

        if (!updated) {
            throw new HTTPException(404, {
                message: "Registration not found",
            });
        }

        return c.json({
            userId,
            eventId,
            name: registration.user.name,
            status: updated.status,
            attendedAt: updated.attendedAt?.toISOString() ?? null,
        } satisfies z.infer<typeof attendanceResponseSchema>);
    },
);
