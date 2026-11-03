import { validator } from "hono-openapi";
import { HTTPAppException } from "~/lib/errors";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
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
            "The caller's own photos from the event, oldest first, drafts and submitted alike. Drafts left when the camera closes are sent in automatically and stay listed. Never carries a URL: fetch the image with `getMyWrappedPhotoImage`.",
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
            where: { id: eventId },
            columns: { id: true },
        });
        if (!event) {
            throw HTTPAppException.NotFound("Event");
        }

        const photos = await db.query.wrappedPhoto.findMany({
            where: {
                eventId,
                uploadedById: c.get("user").id,
            },
            orderBy: { createdAt: "asc", id: "asc" },
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
