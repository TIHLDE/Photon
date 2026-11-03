import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import type z from "zod";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import {
    inStory,
    readPhotoStats,
    requireReadableStory,
} from "~/lib/wrapped/story";
import { requireAuth } from "~/middleware/auth";
import {
    PaginationSchema,
    getNextPage,
    getPageOffset,
    getTotalPages,
} from "~/middleware/pagination";
import { eventIdParamSchema, wrappedStorySchema } from "./schema";

export const getWrappedStoryRoute = route().get(
    "/:eventId/wrapped/story",
    describeRoute({
        tags: ["wrapped"],
        summary: "Get the event's Wrapped story",
        operationId: "getWrappedStory",
        description:
            "The published story of an event: the event itself, shown first, then the photos the organizer picked, in the order they were taken, with who took them and their likes and comments. Any logged-in member can read a published story. Before it is published only the organizer can, as a preview; everyone else gets 404.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: wrappedStorySchema,
            description: "OK",
        })
        .unauthorized({ description: "Authentication required" })
        .notFound({ description: "No published story for this event" })
        .build(),
    requireAuth,
    validator("param", eventIdParamSchema),
    validator("query", PaginationSchema),
    async (c) => {
        const ctx = c.get("ctx");
        const user = c.get("user");
        const { eventId } = c.req.valid("param");
        const { page, pageSize } = c.req.valid("query");

        const event = await requireReadableStory(ctx, eventId, user.id);

        const totalCount = await ctx.db.$count(
            schema.wrappedPhoto,
            and(eq(schema.wrappedPhoto.eventId, eventId), inStory()),
        );
        const totalPages = getTotalPages(totalCount, pageSize);

        // In the order they were taken, so the story retells the evening.
        const photos = await ctx.db.query.wrappedPhoto.findMany({
            where: {
                eventId,
                submittedAt: { isNotNull: true },
                selectedAt: { isNotNull: true },
            },
            orderBy: { createdAt: "asc", id: "asc" },
            limit: pageSize,
            offset: getPageOffset(page, pageSize),
            columns: { id: true, createdAt: true },
            with: {
                uploadedBy: { columns: { id: true, name: true, image: true } },
            },
        });
        const stats = await readPhotoStats(
            ctx.db,
            photos.map((photo) => photo.id),
            user.id,
        );

        return c.json({
            totalCount,
            pages: totalPages,
            nextPage: getNextPage(page, totalPages),
            event: {
                id: event.id,
                slug: event.slug,
                title: event.title,
                start: event.start.toISOString(),
                end: event.end.toISOString(),
                imageUrl: event.imageUrl,
            },
            publishedAt: event.publishedAt?.toISOString() ?? null,
            layout: event.layout,
            items: photos.map((photo) => ({
                id: photo.id,
                takenAt: photo.createdAt.toISOString(),
                photographer: {
                    id: photo.uploadedBy.id,
                    name: photo.uploadedBy.name,
                    image: photo.uploadedBy.image,
                },
                imageUrl: `/api/event/${eventId}/wrapped/story/photos/${photo.id}/image`,
                likeCount: 0,
                likedByMe: false,
                commentCount: 0,
                ...stats.get(photo.id),
            })),
        } satisfies z.infer<typeof wrappedStorySchema>);
    },
);
