import { schema } from "@photon/db";
import { validator } from "hono-openapi";
import { HTTPAppException } from "~/lib/errors";
import { requireEventAccess } from "~/lib/event/access";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import {
    DEFAULT_SHOTS_PER_PERSON,
    WRAPPED_ARRANGER_PERMISSIONS,
    getCameraStatus,
} from "~/lib/wrapped";
import { requireAuth } from "~/middleware/auth";
import {
    eventIdParamSchema,
    setWrappedCameraSchema,
    wrappedCameraSchema,
} from "./schema";
import { serializeCameraStatus } from "./serialize";

export const setWrappedCameraRoute = route().put(
    "/:eventId/wrapped",
    describeRoute({
        tags: ["wrapped"],
        summary: "Turn the event's camera on or off",
        operationId: "setWrappedCamera",
        description:
            "Turn the disposable camera on or off for an event and set how many photos each member may take. Requires 'events:update' or 'events:manage', globally or for the arranging group. Turning the camera off keeps the photos already taken.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: wrappedCameraSchema,
            description: "OK",
        })
        .forbidden({
            description: "Requires events:update or events:manage permission",
        })
        .notFound({ description: "Event not found" })
        .build(),
    requireAuth,
    // Before the access check: that check looks the event up, and an id that
    // is not a uuid would reach Postgres and come back as a 500.
    validator("param", eventIdParamSchema),
    requireEventAccess({ permission: WRAPPED_ARRANGER_PERMISSIONS }),
    validator("json", setWrappedCameraSchema),
    async (c) => {
        const ctx = c.get("ctx");
        const user = c.get("user");
        const { eventId } = c.req.valid("param");
        const { enabled, shotsPerPerson } = c.req.valid("json");

        // Checked before the write: without the event the insert would die on
        // the foreign key and surface as a 500 instead of a 404.
        if (!(await getCameraStatus(ctx, eventId, user.id))) {
            throw HTTPAppException.NotFound("Event");
        }

        await ctx.db
            .insert(schema.wrappedCamera)
            .values({
                eventId,
                enabled,
                shotsPerPerson: shotsPerPerson ?? DEFAULT_SHOTS_PER_PERSON,
            })
            .onConflictDoUpdate({
                target: schema.wrappedCamera.eventId,
                set: {
                    enabled,
                    // Omitted means "leave it", not "back to the default".
                    ...(shotsPerPerson === undefined ? {} : { shotsPerPerson }),
                    updatedAt: new Date(),
                },
            });

        c.get("logger").info(
            { eventId, enabled, shotsPerPerson },
            "Wrapped camera settings changed",
        );

        const status = await getCameraStatus(ctx, eventId, user.id);
        if (!status) {
            throw HTTPAppException.NotFound("Event");
        }

        return c.json(serializeCameraStatus(status));
    },
);
