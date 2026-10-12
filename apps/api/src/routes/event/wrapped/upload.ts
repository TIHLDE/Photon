import { validator } from "hono-openapi";
import { MAX_FILE_SIZE, deleteAsset, generateAssetKey } from "~/lib/asset";
import {
    IMAGE_MAX_DIMENSION,
    isOptimizableImage,
    optimizeImage,
} from "~/lib/asset/image";
import { HTTPAppException } from "~/lib/errors";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { type CameraBlockedReason, getCameraStatus } from "~/lib/wrapped";
import { findPhotoReplay, insertPhotoIfAllowed } from "~/lib/wrapped/quota";
import { requireAuth } from "~/middleware/auth";
import {
    eventIdParamSchema,
    uploadWrappedPhotoQuerySchema,
    uploadWrappedPhotoResponseSchema,
} from "./schema";

/**
 * Out of photos is a conflict with what the member has already done; every
 * other reason is something they are not allowed to do right now.
 */
function rejection(reason: CameraBlockedReason): HTTPAppException {
    return reason === "no_shots_left"
        ? HTTPAppException.Conflict(
              "Du har brukt opp bildene dine på dette arrangementet.",
          )
        : new HTTPAppException({
              status: 403,
              message: "Kameraet er ikke tilgjengelig for deg akkurat nå.",
              meta: { reason },
          });
}

const KEY_IN_USE = () =>
    HTTPAppException.BadRequest(
        "The idempotency key belongs to another photo. Use a new UUID per photo.",
    );

export const uploadWrappedPhotoRoute = route().post(
    "/:eventId/wrapped/photos",
    describeRoute({
        tags: ["wrapped"],
        summary: "Upload a photo taken with the event's camera",
        operationId: "uploadWrappedPhoto",
        description: `Upload one photo to the event's disposable camera. The caller must hold a spot on the event, the camera must be on and inside its window, and the caller must have photos left.

The photo is stored hidden: the response carries the new counts and never a URL, and nothing serves the image until the organizer publishes it.

**Usage:**
Send the file as multipart/form-data with a field named "file". JPEG, PNG and WebP only, at most ${MAX_FILE_SIZE / 1024 / 1024}MB. The image is re-encoded to WebP, scaled to fit within ${IMAGE_MAX_DIMENSION}x${IMAGE_MAX_DIMENSION} px and stripped of metadata.

A photo is spent only by a 201.

**Retrying:**
Pass \`idempotencyKey\`, a UUID the client makes up per photo. If an upload's answer is lost and the same photo is sent again under the same key, the first one is found and answered with a 200 and the current counts — nothing is stored twice and no second photo is spent.`,
    })
        .schemaResponse({
            statusCode: 201,
            schema: uploadWrappedPhotoResponseSchema,
            description: "Photo stored",
        })
        .schemaResponse({
            statusCode: 200,
            schema: uploadWrappedPhotoResponseSchema,
            description:
                "This photo was already stored by an earlier attempt with the same idempotency key",
        })
        .badRequest({
            description:
                "Missing file, wrong type or too large, or an idempotency key that belongs to another photo",
        })
        .forbidden({
            description:
                "The camera is off or outside its window, or the caller holds no spot on the event. `meta.reason` says which.",
        })
        .notFound({ description: "Event not found" })
        .response({
            statusCode: 409,
            description: "Conflict - the caller has no photos left",
        })
        .build(),
    requireAuth,
    validator("param", eventIdParamSchema),
    validator("query", uploadWrappedPhotoQuerySchema),
    async (c) => {
        const ctx = c.get("ctx");
        const { db, bucket } = ctx;
        const logger = c.get("logger");
        const user = c.get("user");
        const { eventId } = c.req.valid("param");
        const { idempotencyKey } = c.req.valid("query");
        const owner = { eventId, userId: user.id };

        const status = await getCameraStatus(ctx, eventId, user.id);
        if (!status) {
            throw HTTPAppException.NotFound("Event");
        }

        // A retry of a photo that already landed is answered before anything
        // else: it must succeed even when that photo was their last, or the
        // camera has closed since, and there is no reason to receive the file
        // a second time.
        const replay = idempotencyKey
            ? await findPhotoReplay(db, idempotencyKey, owner)
            : null;
        if (idempotencyKey && replay === "mine") {
            logger.info(
                { eventId, photoId: idempotencyKey },
                "Wrapped upload replayed",
            );
            return c.json(
                {
                    id: idempotencyKey,
                    shotsUsed: status.shotsUsed,
                    shotsLeft: status.shotsLeft,
                },
                200,
            );
        }
        if (replay === "taken") {
            throw KEY_IN_USE();
        }

        // A cheap first answer, before the file is even read. It is not the
        // one that counts — see `insertPhotoIfAllowed`.
        if (status.reason) {
            logger.warn(
                { eventId, reason: status.reason },
                "Wrapped upload rejected",
            );
            throw rejection(status.reason);
        }

        const formData = await c.req.formData();
        const file = formData.get("file");

        if (!file || !(file instanceof File)) {
            throw HTTPAppException.BadRequest(
                "No file provided. Send a file with field name 'file'.",
            );
        }
        if (file.size > MAX_FILE_SIZE) {
            throw HTTPAppException.BadRequest(
                `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
            );
        }
        // Narrower than the general upload route on purpose: a camera takes
        // pictures, not PDFs, and an animated GIF is not a photo.
        if (!isOptimizableImage(file.type)) {
            throw HTTPAppException.BadRequest(
                `File type '${file.type}' is not allowed. Send a JPEG, PNG or WebP image.`,
            );
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const optimized = await optimizeImage(
            buffer,
            file.type,
            file.name,
            logger,
        );

        const storedFilename = optimized?.filename ?? file.name;
        const key = generateAssetKey(storedFilename);

        // Stored before the row exists, so a row never points at a missing
        // file. Private from the first byte: there is no moment where the open
        // asset route could serve it.
        await bucket.upload(key, optimized?.buffer ?? buffer, {
            originalFilename: storedFilename,
            contentType: optimized?.contentType ?? file.type,
            uploadedById: user.id,
            visibility: "private",
        });

        let photo: Awaited<ReturnType<typeof insertPhotoIfAllowed>>;
        try {
            photo = await insertPhotoIfAllowed(db, {
                ...owner,
                assetKey: key,
                id: idempotencyKey,
            });
        } catch (error) {
            await deleteAsset(bucket, key);
            logger.error(
                { err: error, eventId },
                "Wrapped upload failed after the file was stored",
            );
            throw error;
        }

        if ("rejected" in photo) {
            await deleteAsset(bucket, key);
            logger.warn(
                { eventId, reason: photo.rejected },
                "Wrapped upload rejected after the file was stored",
            );
            if (photo.rejected === "event_not_found") {
                throw HTTPAppException.NotFound("Event");
            }
            if (photo.rejected === "key_in_use") {
                throw KEY_IN_USE();
            }
            throw rejection(photo.rejected);
        }

        const answer = {
            id: photo.id,
            shotsUsed: photo.shotsUsed,
            shotsLeft: photo.shotsLeft,
        };

        // Two attempts under the same key got past the first look together.
        // The other one stored the photo; this file is the spare.
        if (photo.replayed) {
            await deleteAsset(bucket, key);
            logger.info(
                { eventId, photoId: photo.id },
                "Wrapped upload replayed",
            );
            return c.json(answer, 200);
        }

        // After the insert on purpose. If the process dies between the two,
        // the file is still staged but a row points at it, and the staging
        // cleanup rescues what a row references. The other order would leave
        // a promoted file no row owns, which nothing ever cleans up.
        await bucket.promoteAsset(key);

        logger.info(
            { eventId, photoId: photo.id, shotsUsed: photo.shotsUsed },
            "Wrapped photo uploaded",
        );

        return c.json(answer, 201);
    },
);
