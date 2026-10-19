import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { cameraWindow, visibleToOwner } from "~/lib/wrapped";
import { requireAuth } from "~/middleware/auth";
import { photoImageResponse } from "./photo-image";
import { photoImageQuerySchema, photoParamSchema } from "./schema";

export const getMyWrappedPhotoImageRoute = route().get(
    "/:eventId/wrapped/photos/mine/:photoId/image",
    describeRoute({
        tags: ["wrapped"],
        summary: "Get the image of one of my photos",
        operationId: "getMyWrappedPhotoImage",
        description:
            "The image bytes of one of the caller's own photos at this event. Pass `w` for a smaller WebP variant. Answers 404 for anyone else's photo, a deleted one, or a draft left when the camera closed.",
    })
        .response({ statusCode: 200, description: "The image" })
        .notFound({ description: "Photo not found" })
        .unauthorized({ description: "Authentication required" })
        .build(),
    requireAuth,
    validator("param", photoParamSchema),
    validator("query", photoImageQuerySchema),
    async (c) => {
        const { db, bucket } = c.get("ctx");
        const { eventId, photoId } = c.req.valid("param");
        const { w } = c.req.valid("query");

        const event = await db.query.event.findFirst({
            where: eq(schema.event.id, eventId),
            columns: { start: true, end: true },
        });

        // Matched on event and owner, so a guessed id never reaches another
        // member's photo — it answers exactly like a missing one.
        const photo =
            event &&
            (await db.query.wrappedPhoto.findFirst({
                where: and(
                    eq(schema.wrappedPhoto.id, photoId),
                    eq(schema.wrappedPhoto.eventId, eventId),
                    eq(schema.wrappedPhoto.uploadedById, c.get("user").id),
                    visibleToOwner(cameraWindow(event).closesAt),
                ),
                columns: { assetKey: true },
            }));

        return photoImageResponse(bucket, c.get("logger"), photo?.assetKey, w, {
            eventId,
            photoId,
        });
    },
);
