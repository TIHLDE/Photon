import { validator } from "hono-openapi";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireStoryPhoto } from "~/lib/wrapped/story";
import { requireAuth } from "~/middleware/auth";
import { photoImageResponse } from "./photo-image";
import { photoImageQuerySchema, photoParamSchema } from "./schema";

export const getWrappedStoryPhotoImageRoute = route().get(
    "/:eventId/wrapped/story/photos/:photoId/image",
    describeRoute({
        tags: ["wrapped"],
        summary: "Get the image of a photo in the event's story",
        operationId: "getWrappedStoryPhotoImage",
        description:
            "The image bytes of one picked photo in a published story, for any logged-in member. Pass `w` for a smaller WebP variant. A photo that is not picked, or a story that is not published, answers 404 — except to the organizer, who can preview.",
    })
        .response({ statusCode: 200, description: "The image" })
        .unauthorized({ description: "Authentication required" })
        .notFound({ description: "Photo not found" })
        .build(),
    requireAuth,
    validator("param", photoParamSchema),
    validator("query", photoImageQuerySchema),
    async (c) => {
        const ctx = c.get("ctx");
        const { eventId, photoId } = c.req.valid("param");
        const { w } = c.req.valid("query");

        const photo = await requireStoryPhoto(
            ctx,
            eventId,
            photoId,
            c.get("user").id,
        );
        return photoImageResponse(
            ctx.bucket,
            c.get("logger"),
            photo.assetKey,
            w,
            {
                eventId,
                photoId,
            },
        );
    },
);
