import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPAppException } from "~/lib/errors";
import { requireEventAccess } from "~/lib/event/access";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { WRAPPED_ARRANGER_PERMISSIONS } from "~/lib/wrapped";
import { requireAuth } from "~/middleware/auth";
import {
    photoParamSchema,
    updateWrappedPhotoSchema,
    wrappedPhotoSchema,
} from "./schema";
import { serializePhoto } from "./serialize";

export const updateWrappedPhotoRoute = route().patch(
    "/:eventId/wrapped/photos/:photoId",
    describeRoute({
        tags: ["wrapped"],
        summary: "Pick a photo, or take it out of the selection",
        operationId: "updateWrappedPhoto",
        description:
            "Mark one of the event's photos as picked for publishing, or undo it. Requires 'events:update' or 'events:manage', globally or for the arranging group.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: wrappedPhotoSchema,
            description: "OK",
        })
        .forbidden({
            description: "Requires events:update or events:manage permission",
        })
        .notFound({ description: "Photo not found" })
        .build(),
    requireAuth,
    // Before the access check, which would otherwise hand Postgres an id
    // that is not a uuid.
    validator("param", photoParamSchema),
    requireEventAccess({ permission: WRAPPED_ARRANGER_PERMISSIONS }),
    validator("json", updateWrappedPhotoSchema),
    async (c) => {
        const { db } = c.get("ctx");
        const { eventId, photoId } = c.req.valid("param");
        const { selected } = c.req.valid("json");

        const where = and(
            eq(schema.wrappedPhoto.id, photoId),
            eq(schema.wrappedPhoto.eventId, eventId),
        );

        const existing = await db.query.wrappedPhoto.findFirst({
            where,
            with: { uploadedBy: { columns: { id: true, name: true } } },
        });
        if (!existing) {
            throw HTTPAppException.NotFound("Photo");
        }

        // Picking an already picked photo keeps the first timestamp, so the
        // column says when it was chosen and not when it was last tapped.
        const selectedAt = selected
            ? (existing.selectedAt ?? new Date())
            : null;
        await db.update(schema.wrappedPhoto).set({ selectedAt }).where(where);

        c.get("logger").info(
            { eventId, photoId, selected },
            "Wrapped photo selection changed",
        );

        return c.json(serializePhoto({ ...existing, selectedAt }));
    },
);
