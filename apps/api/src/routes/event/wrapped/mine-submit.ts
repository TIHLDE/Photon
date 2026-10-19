import { validator } from "hono-openapi";
import { HTTPAppException } from "~/lib/errors";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { submitDrafts } from "~/lib/wrapped/drafts";
import { requireAuth } from "~/middleware/auth";
import {
    eventIdParamSchema,
    submitMyWrappedPhotosResponseSchema,
    submitMyWrappedPhotosSchema,
} from "./schema";

export const submitMyWrappedPhotosRoute = route().post(
    "/:eventId/wrapped/photos/mine/submit",
    describeRoute({
        tags: ["wrapped"],
        summary: "Submit my drafts to the organizer",
        operationId: "submitMyWrappedPhotos",
        description:
            "Submit the listed drafts, or all of them when `photoIds` is omitted. Submitted photos are what the organizer picks from. Safe to repeat: a photo already submitted, or an id that is not one of the caller's drafts, changes nothing. Only while the camera is open — after it closes, drafts are discarded.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: submitMyWrappedPhotosResponseSchema,
            description: "OK",
        })
        .notFound({ description: "Event not found" })
        .response({
            statusCode: 409,
            description: "Conflict - the camera has closed",
        })
        .unauthorized({ description: "Authentication required" })
        .build(),
    requireAuth,
    validator("param", eventIdParamSchema),
    validator("json", submitMyWrappedPhotosSchema),
    async (c) => {
        const { db } = c.get("ctx");
        const { eventId } = c.req.valid("param");
        const { photoIds } = c.req.valid("json");
        const userId = c.get("user").id;

        const result = await submitDrafts(db, { eventId, userId, photoIds });

        if ("rejected" in result) {
            if (result.rejected === "event_not_found") {
                throw HTTPAppException.NotFound("Event");
            }
            throw HTTPAppException.Conflict(
                "Kameraet har stengt, så bildene kan ikke sendes inn lenger.",
            );
        }

        c.get("logger").info(
            { eventId, userId, submittedCount: result.submittedCount },
            "Wrapped drafts submitted",
        );

        return c.json(result);
    },
);
