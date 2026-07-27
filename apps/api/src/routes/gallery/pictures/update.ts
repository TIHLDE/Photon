import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { findAlbumBySlugOrId } from "~/lib/gallery";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import { galleryPictureSchema, updateGalleryPictureSchema } from "../schema";

export const updatePictureRoute = route().patch(
    "/:slug/pictures/:pictureId",
    describeRoute({
        tags: ["gallery"],
        summary: "Update a picture",
        operationId: "updateGalleryPicture",
        description:
            "Update the title, description or alt text of a picture. Requires 'galleries:pictures:update' or 'galleries:manage' permission.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: galleryPictureSchema,
            description: "Picture updated",
        })
        .forbidden({ description: "Insufficient permissions" })
        .notFound({ description: "Gallery or picture not found" })
        .build(),
    requireAuth,
    requireAccess({
        permission: ["galleries:pictures:update", "galleries:manage"],
    }),
    validator("json", updateGalleryPictureSchema),
    async (c) => {
        const ctx = c.get("ctx");
        const { slug, pictureId } = c.req.param();
        const body = c.req.valid("json");

        const album = await findAlbumBySlugOrId(ctx, slug);
        if (!album) {
            throw new HTTPException(404, { message: "Fant ikke galleriet" });
        }

        const [picture] = await ctx.db
            .update(schema.galleryPicture)
            .set(body)
            .where(
                and(
                    eq(schema.galleryPicture.id, pictureId),
                    eq(schema.galleryPicture.albumId, album.id),
                ),
            )
            .returning();

        if (!picture) {
            throw new HTTPException(404, { message: "Fant ikke bildet" });
        }

        return c.json({
            id: picture.id,
            albumId: picture.albumId,
            imageUrl: picture.imageUrl,
            imageAlt: picture.imageAlt ?? null,
            title: picture.title ?? null,
            description: picture.description ?? null,
            createdAt: picture.createdAt.toISOString(),
            updatedAt: picture.updatedAt.toISOString(),
        });
    },
);
