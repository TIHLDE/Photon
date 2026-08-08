import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import {
    findAlbumBySlugOrId,
    findAlbumEvent,
    serializeAlbum,
} from "~/lib/gallery";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { gallerySchema } from "./schema";

export const getRoute = route().get(
    "/:slug",
    describeRoute({
        tags: ["gallery"],
        summary: "Get gallery",
        operationId: "getGallery",
        description:
            "Get a single album by slug (or ID). Pictures are fetched separately via /api/galleries/{slug}/pictures. Requires authentication.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: gallerySchema,
            description: "Album details",
        })
        .notFound({ description: "Gallery not found" })
        .build(),
    requireAuth,
    async (c) => {
        const ctx = c.get("ctx");
        const { slug } = c.req.param();

        const album = await findAlbumBySlugOrId(ctx, slug);

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
