import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { findAlbumBySlugOrId, isAlbumCreator } from "~/lib/gallery";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import { deleteGalleryResponseSchema } from "./schema";

export const deleteRoute = route().delete(
    "/:slug",
    describeRoute({
        tags: ["gallery"],
        summary: "Delete gallery",
        operationId: "deleteGallery",
        description:
            "Delete an album and every picture in it. Requires 'galleries:delete' or 'galleries:manage' permission, or being the creator.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: deleteGalleryResponseSchema,
            description: "Album deleted",
        })
        .forbidden({ description: "Insufficient permissions" })
        .notFound({ description: "Gallery not found" })
        .build(),
    requireAuth,
    requireAccess({
        permission: ["galleries:delete", "galleries:manage"],
        ownership: { param: "slug", check: isAlbumCreator },
    }),
    async (c) => {
        const ctx = c.get("ctx");
        const { slug } = c.req.param();

        const album = await findAlbumBySlugOrId(ctx, slug);
        if (!album) {
            throw new HTTPException(404, { message: "Fant ikke galleriet" });
        }

        // Pictures go with it via the cascading FK.
        await ctx.db
            .delete(schema.galleryAlbum)
            .where(eq(schema.galleryAlbum.id, album.id));

        return c.json({ message: "Galleriet ble slettet" });
    },
);
