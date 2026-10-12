import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { type ImageVariantWidth, isOptimizableImage } from "~/lib/asset/image";
import { getImageVariant } from "~/lib/asset/variant";
import { HTTPAppException } from "~/lib/errors";
import { requireEventAccess } from "~/lib/event/access";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { WRAPPED_ARRANGER_PERMISSIONS } from "~/lib/wrapped";
import { requireAuth } from "~/middleware/auth";
import { photoImageQuerySchema, photoParamSchema } from "./schema";

export const getWrappedPhotoImageRoute = route().get(
    "/:eventId/wrapped/photos/:photoId/image",
    describeRoute({
        tags: ["wrapped"],
        summary: "Get the image of a photo taken at an event",
        operationId: "getWrappedPhotoImage",
        description:
            "The image bytes of one photo, for the organizer. Pass `w` for a smaller WebP variant; it is generated on first request and kept. This is the only route that serves a photo before it is published: the asset is private and the open asset route answers 404 for it. Requires 'events:update' or 'events:manage', globally or for the arranging group.",
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
            where: and(
                eq(schema.wrappedPhoto.id, photoId),
                eq(schema.wrappedPhoto.eventId, eventId),
            ),
            columns: { assetKey: true },
        });
        const asset = photo && (await bucket.getAsset(photo.assetKey));
        if (!asset) {
            throw HTTPAppException.NotFound("Photo");
        }

        const isImage =
            asset.contentType !== null && isOptimizableImage(asset.contentType);

        let body: Buffer;
        let resized = false;
        try {
            // A variant is cached under a key that has no asset row, so the
            // open asset route cannot serve it either. `deleteAsset` removes
            // variants along with the original, which is why deleting a
            // wrapped photo must go through it and never the bucket directly.
            if (w && isImage) {
                ({ body, resized } = await getImageVariant(
                    bucket,
                    asset.key,
                    Number(w) as ImageVariantWidth,
                    c.get("logger"),
                ));
            } else {
                body = await bucket.download(asset.key);
            }
        } catch (error) {
            c.get("logger").error(
                { err: error, eventId, photoId },
                "Wrapped photo has a row but no stored file",
            );
            throw HTTPAppException.NotFound("Photo");
        }

        // Uploads are limited to these types already; checked again here so
        // a row pointed at anything else can never be served as something a
        // browser would render or run.
        const contentType = resized
            ? "image/webp"
            : isImage && asset.contentType
              ? asset.contentType
              : "application/octet-stream";

        return new Response(new Uint8Array(body), {
            status: 200,
            headers: {
                "Content-Type": contentType,
                "X-Content-Type-Options": "nosniff",
                "Content-Security-Policy": "default-src 'none'; sandbox",
                "Content-Length": body.length.toString(),
                // `private` keeps nginx and any CDN from handing the photo to
                // someone else; `no-store` because the organizer's access can
                // end, and the photo may be deleted, long before a cache would.
                "Cache-Control": "private, no-store",
            },
        });
    },
);
