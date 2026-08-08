import { schema } from "@photon/db";
import { and, eq, inArray } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import type z from "zod";
import zod from "zod";
import { requireEventAccess } from "~/lib/event/access";
import { Schema, describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";

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
        .build(),
    requireAuth,
    requireEventAccess({ permission: ["events:update", "events:manage"] }),
    validator("json", setAttendanceSchema),
    async (c) => {
        const { db } = c.get("ctx");
        const eventId = c.req.param("eventId");
        const userId = c.req.param("userId");
        const { attended } = c.req.valid("json");

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
                    // Only real spots can be checked in — not waitlisted/pending.
                    inArray(schema.eventRegistration.status, [
                        "registered",
                        "attended",
                        "no_show",
                    ]),
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
            status: updated.status,
            attendedAt: updated.attendedAt?.toISOString() ?? null,
        } satisfies z.infer<typeof attendanceResponseSchema>);
    },
);
