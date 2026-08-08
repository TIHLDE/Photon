import { schema } from "@photon/db";
import { asc, eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import type z from "zod";
import { findAlbumBySlugOrId } from "~/lib/gallery";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import {
    PaginationSchema,
    getPageOffset,
    getTotalPages,
} from "~/middleware/pagination";
import { galleryPictureListResponseSchema } from "../schema";

export const listPicturesRoute = route().get(
    "/:slug/pictures",
    describeRoute({
        tags: ["gallery"],
        summary: "List pictures in a gallery",
        operationId: "listGalleryPictures",
        description:
            "Get a paginated list of the pictures in an album. This is what backs the 'Last inn mer' button. Members only.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: galleryPictureListResponseSchema,
            description: "OK",
        })
        .notFound({ description: "Gallery not found" })
        .unauthorized({ description: "Authentication required" })
        .build(),
    requireAuth,
    validator("query", PaginationSchema),
    async (c) => {
        const ctx = c.get("ctx");
        const { slug } = c.req.param();
        const { page, pageSize } = c.req.valid("query");

        const album = await findAlbumBySlugOrId(ctx, slug);
        if (!album) {
            throw new HTTPException(404, { message: "Fant ikke galleriet" });
        }

        const where = eq(schema.galleryPicture.albumId, album.id);
        const totalCount = await ctx.db.$count(schema.galleryPicture, where);
        const totalPages = getTotalPages(totalCount, pageSize);

        /**
         * Oldest first, so paging forward appends to the end of the grid and
         * never reshuffles pictures the user is already looking at.
         */
        const pictures = await ctx.db.query.galleryPicture.findMany({
            where,
            orderBy: [
                asc(schema.galleryPicture.createdAt),
                asc(schema.galleryPicture.id),
            ],
            limit: pageSize,
            offset: getPageOffset(page, pageSize),
        });

        return c.json({
            totalCount,
            pages: totalPages,
            nextPage: page + 1 >= totalPages ? null : page + 1,
            items: pictures.map((p) => ({
                id: p.id,
                albumId: p.albumId,
                imageUrl: p.imageUrl,
                imageAlt: p.imageAlt ?? null,
                title: p.title ?? null,
                description: p.description ?? null,
                createdAt: p.createdAt.toISOString(),
                updatedAt: p.updatedAt.toISOString(),
            })),
        } satisfies z.infer<typeof galleryPictureListResponseSchema>);
    },
);
