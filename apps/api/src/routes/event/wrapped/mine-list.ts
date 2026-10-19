import { schema } from "@photon/db";
import { and, asc, eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPAppException } from "~/lib/errors";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { cameraWindow, visibleToOwner } from "~/lib/wrapped";
import { requireAuth } from "~/middleware/auth";
import { eventIdParamSchema, myWrappedPhotoListSchema } from "./schema";
import { serializeMyPhoto } from "./serialize";

export const getMyWrappedPhotosRoute = route().get(
    "/:eventId/wrapped/photos/mine",
    describeRoute({
        tags: ["wrapped"],
        summary: "List my photos from the event's camera",
        operationId: "getMyWrappedPhotos",
        description:
            "The caller's own photos at this event, oldest first, drafts and submitted alike. Once the camera has closed, drafts are gone and only submitted photos are listed. Never carries a URL: fetch the image with `getMyWrappedPhotoImage`.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: myWrappedPhotoListSchema,
            description: "OK",
        })
        .notFound({ description: "Event not found" })
        .unauthorized({ description: "Authentication required" })
        .build(),
    requireAuth,
    validator("param", eventIdParamSchema),
    async (c) => {
        const { db } = c.get("ctx");
        const { eventId } = c.req.valid("param");

        const event = await db.query.event.findFirst({
            where: eq(schema.event.id, eventId),
            columns: { start: true, end: true },
        });
        if (!event) {
            throw HTTPAppException.NotFound("Event");
        }

        const photos = await db.query.wrappedPhoto.findMany({
            where: and(
                eq(schema.wrappedPhoto.eventId, eventId),
                eq(schema.wrappedPhoto.uploadedById, c.get("user").id),
                visibleToOwner(cameraWindow(event).closesAt),
            ),
            orderBy: [
                asc(schema.wrappedPhoto.createdAt),
                asc(schema.wrappedPhoto.id),
            ],
            columns: {
                id: true,
                source: true,
                submittedAt: true,
                createdAt: true,
            },
        });

        return c.json(photos.map(serializeMyPhoto));
    },
);
