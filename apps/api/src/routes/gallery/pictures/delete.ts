import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { findAlbumBySlugOrId } from "~/lib/gallery";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import { deleteGalleryPictureResponseSchema } from "../schema";

export const deletePictureRoute = route().delete(
    "/:slug/pictures/:pictureId",
    describeRoute({
        tags: ["gallery"],
        summary: "Remove a picture from a gallery",
        operationId: "deleteGalleryPicture",
        description:
            "Remove a single picture from an album. Requires 'galleries:pictures:delete' or 'galleries:manage' permission.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: deleteGalleryPictureResponseSchema,
            description: "Picture removed",
        })
        .forbidden({ description: "Insufficient permissions" })
        .notFound({ description: "Gallery or picture not found" })
        .build(),
    requireAuth,
    requireAccess({
        permission: ["galleries:pictures:delete", "galleries:manage"],
    }),
    async (c) => {
        const ctx = c.get("ctx");
        const { slug, pictureId } = c.req.param();

        const album = await findAlbumBySlugOrId(ctx, slug);
        if (!album) {
            throw new HTTPException(404, { message: "Fant ikke galleriet" });
        }

        const [deleted] = await ctx.db
            .delete(schema.galleryPicture)
            .where(
                and(
                    eq(schema.galleryPicture.id, pictureId),
                    eq(schema.galleryPicture.albumId, album.id),
                ),
            )
            .returning({ id: schema.galleryPicture.id });

        if (!deleted) {
            throw new HTTPException(404, { message: "Fant ikke bildet" });
        }

        return c.json({ message: "Bildet ble fjernet fra galleriet" });
    },
);
