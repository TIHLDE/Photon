import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { requireEventAccess } from "~/lib/event/access";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { WRAPPED_ARRANGER_PERMISSIONS, submittedOnly } from "~/lib/wrapped";
import { requireAuth } from "~/middleware/auth";
import { photoImageResponse } from "./photo-image";
import { photoImageQuerySchema, photoParamSchema } from "./schema";

export const getWrappedPhotoImageRoute = route().get(
    "/:eventId/wrapped/photos/:photoId/image",
    describeRoute({
        tags: ["wrapped"],
        summary: "Get the image of a photo taken at an event",
        operationId: "getWrappedPhotoImage",
        description:
            "The image bytes of one submitted photo, for the organizer. Pass `w` for a smaller WebP variant; it is generated on first request and kept. This is the only route that serves a photo before it is published: the asset is private and the open asset route answers 404 for it. Requires 'events:update' or 'events:manage', globally or for the arranging group.",
    })
        .response({ statusCode: 200, description: "The image" })
        .forbidden({
            description: "Requires events:update or events:manage permission",
        })
        .notFound({ description: "Photo not found" })
        .build(),
    requireAuth,
    // Before the access check, which would otherwise hand Postgres an id
    // that is not a uuid.
    validator("param", photoParamSchema),
    validator("query", photoImageQuerySchema),
    requireEventAccess({ permission: WRAPPED_ARRANGER_PERMISSIONS }),
    async (c) => {
        const { db, bucket } = c.get("ctx");
        const { eventId, photoId } = c.req.valid("param");
        const { w } = c.req.valid("query");

        // Matched on the event as well, so access to one event's photos can
        // never be used to read another's by guessing an id.
        const photo = await db.query.wrappedPhoto.findFirst({
            // Submitted only: a draft is the member's alone.
            where: and(
                eq(schema.wrappedPhoto.id, photoId),
                eq(schema.wrappedPhoto.eventId, eventId),
                submittedOnly(),
            ),
            columns: { assetKey: true },
        });
        return photoImageResponse(bucket, c.get("logger"), photo?.assetKey, w, {
            eventId,
            photoId,
        });
    },
);
