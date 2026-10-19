import { validator } from "hono-openapi";
import { deleteAsset } from "~/lib/asset";
import { HTTPAppException } from "~/lib/errors";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { deleteDraft } from "~/lib/wrapped/drafts";
import { requireAuth } from "~/middleware/auth";
import { deleteMyWrappedPhotoResponseSchema, photoParamSchema } from "./schema";

export const deleteMyWrappedPhotoRoute = route().delete(
    "/:eventId/wrapped/photos/mine/:photoId",
    describeRoute({
        tags: ["wrapped"],
        summary: "Delete one of my drafts",
        operationId: "deleteMyWrappedPhoto",
        description:
            "Delete one of the caller's drafts, image and all. This gives the shot back. A submitted photo cannot be deleted, and nothing can once the camera has closed.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: deleteMyWrappedPhotoResponseSchema,
            description: "Deleted. The caller's new counts.",
        })
        .notFound({ description: "Photo not found" })
        .response({
            statusCode: 409,
            description:
                "Conflict - the photo is already submitted, or the camera has closed",
        })
        .unauthorized({ description: "Authentication required" })
        .build(),
    requireAuth,
    validator("param", photoParamSchema),
    async (c) => {
        const { db, bucket } = c.get("ctx");
        const logger = c.get("logger");
        const { eventId, photoId } = c.req.valid("param");
        const userId = c.get("user").id;

        const result = await deleteDraft(db, { eventId, userId, photoId });

        if ("rejected" in result) {
            switch (result.rejected) {
                case "not_found":
                    throw HTTPAppException.NotFound("Photo");
                case "submitted":
                    throw HTTPAppException.Conflict(
                        "Bildet er allerede sendt inn og kan ikke slettes.",
                    );
                case "closed":
                    throw HTTPAppException.Conflict(
                        "Kameraet har stengt, så bildet kan ikke slettes.",
                    );
            }
        }

        // After the commit: the row is gone, so the shot is back whatever
        // happens to the file. A file that will not go is logged, not a
        // reason to fail a delete that already took effect.
        try {
            await deleteAsset(bucket, result.assetKey);
        } catch (error) {
            logger.error(
                { err: error, eventId, photoId },
                "Wrapped draft deleted but its file could not be removed",
            );
        }

        logger.info(
            { eventId, userId, photoId, shotsUsed: result.shotsUsed },
            "Wrapped draft deleted",
        );

        return c.json({
            shotsUsed: result.shotsUsed,
            shotsLeft: result.shotsLeft,
        });
    },
);
