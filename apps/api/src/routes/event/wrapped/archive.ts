import { validator } from "hono-openapi";
import type z from "zod";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { listArchivedStories } from "~/lib/wrapped/archive";
import { requireAuth } from "~/middleware/auth";
import {
    getNextPage,
    getPageOffset,
    getTotalPages,
} from "~/middleware/pagination";
import { wrappedArchiveQuerySchema, wrappedArchiveSchema } from "./schema";

export const listWrappedArchiveRoute = route().get(
    "/wrapped/archive",
    describeRoute({
        tags: ["wrapped"],
        summary: "List my Wrapped archive",
        operationId: "listWrappedArchive",
        description:
            "The published stories of every event the caller took part in: held a spot on (registered or attended), or sent in a photo. A story shows up whether or not any of the caller's photos was picked. Newest event first, optionally limited to one semester by the event's start in Norwegian time. Unpublished stories are left out, and come back when published again. Only ever the caller's own archive.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: wrappedArchiveSchema,
            description: "OK",
        })
        .unauthorized({ description: "Authentication required" })
        .build(),
    requireAuth,
    validator("query", wrappedArchiveQuerySchema),
    async (c) => {
        const { db } = c.get("ctx");
        const { page, pageSize, semester } = c.req.valid("query");

        const archive = await listArchivedStories(db, c.get("user").id, {
            semester,
            limit: pageSize,
            offset: getPageOffset(page, pageSize),
        });
        const totalPages = getTotalPages(archive.totalCount, pageSize);

        return c.json({
            totalCount: archive.totalCount,
            pages: totalPages,
            nextPage: getNextPage(page, totalPages),
            semesters: archive.semesters,
            items: archive.items.map((story) => ({
                event: {
                    id: story.id,
                    slug: story.slug,
                    title: story.title,
                    start: story.start.toISOString(),
                    end: story.end.toISOString(),
                    imageUrl: story.imageUrl,
                },
                semester: story.semester,
                publishedAt: story.publishedAt.toISOString(),
                layout: story.layout,
                photoCount: story.photoCount,
                myPhotoCount: story.myPhotoCount,
                coverImageUrl: story.coverPhotoId
                    ? `/api/event/${story.id}/wrapped/story/photos/${story.coverPhotoId}/image`
                    : null,
            })),
        } satisfies z.infer<typeof wrappedArchiveSchema>);
    },
);
