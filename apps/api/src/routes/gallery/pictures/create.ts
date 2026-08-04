import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { promoteAssetUrls } from "~/lib/asset";
import { findAlbumBySlugOrId } from "~/lib/gallery";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import {
    createGalleryPicturesResponseSchema,
    createGalleryPicturesSchema,
} from "../schema";

export const createPicturesRoute = route().post(
    "/:slug/pictures",
    describeRoute({
        tags: ["gallery"],
        summary: "Add pictures to a gallery",
        operationId: "createGalleryPictures",
        description:
            "Add one or more already-uploaded images to an album. Upload the files via POST /api/assets first, then send the resulting URLs here. Requires 'galleries:pictures:create' or 'galleries:manage' permission.",
    })
        .schemaResponse({
            statusCode: 201,
            schema: createGalleryPicturesResponseSchema,
            description: "Pictures added",
        })
        .forbidden({ description: "Insufficient permissions" })
        .notFound({ description: "Gallery not found" })
        .build(),
    requireAuth,
    requireAccess({
        permission: ["galleries:pictures:create", "galleries:manage"],
    }),
    validator("json", createGalleryPicturesSchema),
    async (c) => {
        const ctx = c.get("ctx");
        const { slug } = c.req.param();
        const { pictures } = c.req.valid("json");

        const album = await findAlbumBySlugOrId(ctx, slug);
        if (!album) {
            throw new HTTPException(404, { message: "Fant ikke galleriet" });
        }

        // Without this every picture disappears from the album two days after
        // it was added.
        await promoteAssetUrls(
            ctx.bucket,
            pictures.map((p) => p.imageUrl),
        );

        const inserted = await ctx.db
            .insert(schema.galleryPicture)
            .values(
                pictures.map((p) => ({
                    albumId: album.id,
                    imageUrl: p.imageUrl,
                    imageAlt: p.imageAlt ?? null,
                    title: p.title ?? null,
                    description: p.description ?? null,
                })),
            )
            .returning();

        /**
         * An album without a cover falls back to its first picture, so a
         * freshly created album stops rendering as a blank card as soon as
         * something is uploaded into it.
         */
        if (!album.imageUrl && inserted[0]) {
            await ctx.db
                .update(schema.galleryAlbum)
                .set({ imageUrl: inserted[0].imageUrl })
                .where(eq(schema.galleryAlbum.id, album.id));
        }

        return c.json(
            {
                created: inserted.length,
                items: inserted.map((p) => ({
                    id: p.id,
                    albumId: p.albumId,
                    imageUrl: p.imageUrl,
                    imageAlt: p.imageAlt ?? null,
                    title: p.title ?? null,
                    description: p.description ?? null,
                    createdAt: p.createdAt.toISOString(),
                    updatedAt: p.updatedAt.toISOString(),
                })),
            },
            201,
        );
    },
);
