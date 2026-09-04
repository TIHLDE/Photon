import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import {
    findAlbumBySlugOrId,
    findAlbumEvent,
    isAlbumCreator,
    serializeAlbum,
} from "~/lib/gallery";
import { claimPrivateAssetUrls } from "~/lib/asset";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import { gallerySchema, updateGallerySchema } from "./schema";

export const updateRoute = route().patch(
    "/:slug",
    describeRoute({
        tags: ["gallery"],
        summary: "Update gallery",
        operationId: "updateGallery",
        description:
            "Update an album. Requires 'galleries:update' or 'galleries:manage' permission, or being the creator. The slug is not regenerated on rename, so existing links keep working.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: gallerySchema,
            description: "Album updated",
        })
        .forbidden({ description: "Insufficient permissions" })
        .notFound({ description: "Gallery not found" })
        .build(),
    requireAuth,
    requireAccess({
        permission: ["galleries:update", "galleries:manage"],
        ownership: { param: "slug", check: isAlbumCreator },
    }),
    validator("json", updateGallerySchema),
    async (c) => {
        const ctx = c.get("ctx");
        const { slug } = c.req.param();
        const body = c.req.valid("json");

        const existing = await findAlbumBySlugOrId(ctx, slug);
        if (!existing) {
            throw new HTTPException(404, { message: "Fant ikke galleriet" });
        }

        // The cover is staged until a row claims it; without this the cleanup
        // cron deletes the file after two days.
        await claimPrivateAssetUrls(ctx.bucket, [body.imageUrl]);

        const [album] = await ctx.db
            .update(schema.galleryAlbum)
            .set(body)
            .where(eq(schema.galleryAlbum.id, existing.id))
            .returning();

        if (!album) {
            throw new HTTPException(404, { message: "Fant ikke galleriet" });
        }

        const pictureCount = await ctx.db.$count(
            schema.galleryPicture,
            eq(schema.galleryPicture.albumId, album.id),
        );
        const event = await findAlbumEvent(ctx, album.eventId);

        return c.json(serializeAlbum(album, pictureCount, event));
    },
);
