import { schema } from "@photon/db";
import { desc, eq, ilike, or, sql } from "drizzle-orm";
import { validator } from "hono-openapi";
import type z from "zod";
import { serializeAlbum } from "~/lib/gallery";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import {
    PaginationSchema,
    getPageOffset,
    getTotalPages,
} from "~/middleware/pagination";
import { galleryListQuerySchema, galleryListResponseSchema } from "./schema";

export const listRoute = route().get(
    "/",
    describeRoute({
        tags: ["gallery"],
        summary: "List galleries",
        operationId: "listGalleries",
        description:
            "Get a paginated list of photo albums, newest first. Members only.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: galleryListResponseSchema,
            description: "OK",
        })
        .unauthorized({ description: "Authentication required" })
        .build(),
    requireAuth,
    validator("query", PaginationSchema.extend(galleryListQuerySchema.shape)),
    async (c) => {
        const { db } = c.get("ctx");
        const { page, pageSize, search } = c.req.valid("query");

        const where = search
            ? or(
                  ilike(schema.galleryAlbum.title, `%${search}%`),
                  ilike(schema.galleryAlbum.description, `%${search}%`),
              )
            : undefined;

        const totalCount = await db.$count(schema.galleryAlbum, where);
        const totalPages = getTotalPages(totalCount, pageSize);

        /**
         * The list view shows "N bilder" per album. Counting in a grouped
         * subquery keeps it to one extra scan — a correlated `sql` fragment
         * cannot be used here, because Drizzle renders column references
         * inside a select field unqualified, which silently compares the
         * wrong columns.
         */
        const pictureCounts = db
            .select({
                albumId: schema.galleryPicture.albumId,
                count: sql<number>`count(*)::int`.as("count"),
            })
            .from(schema.galleryPicture)
            .groupBy(schema.galleryPicture.albumId)
            .as("picture_counts");

        const rows = await db
            .select({
                album: schema.galleryAlbum,
                pictureCount: sql<number>`coalesce(${pictureCounts.count}, 0)`,
                event: {
                    id: schema.event.id,
                    title: schema.event.title,
                    slug: schema.event.slug,
                    start: schema.event.start,
                },
            })
            .from(schema.galleryAlbum)
            .leftJoin(
                pictureCounts,
                eq(pictureCounts.albumId, schema.galleryAlbum.id),
            )
            .leftJoin(
                schema.event,
                eq(schema.event.id, schema.galleryAlbum.eventId),
            )
            .where(where)
            .orderBy(desc(schema.galleryAlbum.createdAt))
            .limit(pageSize)
            .offset(getPageOffset(page, pageSize));

        return c.json({
            totalCount,
            pages: totalPages,
            nextPage: page + 1 >= totalPages ? null : page + 1,
            items: rows.map((row) =>
                serializeAlbum(
                    row.album,
                    row.pictureCount,
                    // The left join yields an all-null object for albums with
                    // no event, not null itself.
                    row.event?.id ? row.event : null,
                ),
            ),
        } satisfies z.infer<typeof galleryListResponseSchema>);
    },
);
