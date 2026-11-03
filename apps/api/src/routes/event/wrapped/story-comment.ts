import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import type z from "zod";
import { canActOnEvent } from "~/lib/event/access";
import { HTTPAppException } from "~/lib/errors";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { WRAPPED_ARRANGER_PERMISSIONS } from "~/lib/wrapped";
import { requireStoryPhoto } from "~/lib/wrapped/story";
import { requireAuth } from "~/middleware/auth";
import {
    PaginationSchema,
    getNextPage,
    getPageOffset,
    getTotalPages,
} from "~/middleware/pagination";
import {
    createWrappedPhotoCommentSchema,
    photoParamSchema,
    storyCommentParamSchema,
    wrappedPhotoCommentListSchema,
    wrappedPhotoCommentSchema,
} from "./schema";

type Comment = {
    id: string;
    body: string;
    createdAt: Date;
    userId: string;
    author: { id: string; name: string; image: string | null };
};

function serializeComment(
    comment: Comment,
    viewer: { id: string; canManage: boolean },
): z.infer<typeof wrappedPhotoCommentSchema> {
    return {
        id: comment.id,
        body: comment.body,
        createdAt: comment.createdAt.toISOString(),
        author: comment.author,
        canDelete: viewer.canManage || comment.userId === viewer.id,
    };
}

export const listWrappedStoryPhotoCommentsRoute = route().get(
    "/:eventId/wrapped/story/photos/:photoId/comments",
    describeRoute({
        tags: ["wrapped"],
        summary: "List the comments on a photo in the event's story",
        operationId: "listWrappedStoryPhotoComments",
        description:
            "Comments on one photo of a story the caller can read, oldest first.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: wrappedPhotoCommentListSchema,
            description: "OK",
        })
        .unauthorized({ description: "Authentication required" })
        .notFound({ description: "Photo not found" })
        .build(),
    requireAuth,
    validator("param", photoParamSchema),
    validator("query", PaginationSchema),
    async (c) => {
        const ctx = c.get("ctx");
        const user = c.get("user");
        const { eventId, photoId } = c.req.valid("param");
        const { page, pageSize } = c.req.valid("query");

        await requireStoryPhoto(ctx, eventId, photoId, user.id);

        const [totalCount, canManage, comments] = await Promise.all([
            ctx.db.$count(
                schema.wrappedPhotoComment,
                eq(schema.wrappedPhotoComment.photoId, photoId),
            ),
            canActOnEvent(ctx, user.id, eventId, WRAPPED_ARRANGER_PERMISSIONS),
            ctx.db.query.wrappedPhotoComment.findMany({
                where: { photoId },
                orderBy: { createdAt: "asc", id: "asc" },
                limit: pageSize,
                offset: getPageOffset(page, pageSize),
                with: {
                    author: { columns: { id: true, name: true, image: true } },
                },
            }),
        ]);
        const totalPages = getTotalPages(totalCount, pageSize);

        return c.json({
            totalCount,
            pages: totalPages,
            nextPage: getNextPage(page, totalPages),
            items: comments.map((comment) =>
                serializeComment(comment, { id: user.id, canManage }),
            ),
        } satisfies z.infer<typeof wrappedPhotoCommentListSchema>);
    },
);

export const createWrappedStoryPhotoCommentRoute = route().post(
    "/:eventId/wrapped/story/photos/:photoId/comments",
    describeRoute({
        tags: ["wrapped"],
        summary: "Comment on a photo in the event's story",
        operationId: "createWrappedStoryPhotoComment",
        description:
            "Add a plain-text comment, 1–500 characters after trimming, to one photo of a story the caller can read.",
    })
        .schemaResponse({
            statusCode: 201,
            schema: wrappedPhotoCommentSchema,
            description: "Created",
        })
        .unauthorized({ description: "Authentication required" })
        .notFound({ description: "Photo not found" })
        .build(),
    requireAuth,
    validator("param", photoParamSchema),
    validator("json", createWrappedPhotoCommentSchema),
    async (c) => {
        const ctx = c.get("ctx");
        const user = c.get("user");
        const { eventId, photoId } = c.req.valid("param");
        const { body } = c.req.valid("json");

        await requireStoryPhoto(ctx, eventId, photoId, user.id);

        const [comment] = await ctx.db
            .insert(schema.wrappedPhotoComment)
            .values({ photoId, userId: user.id, body })
            .returning();
        if (!comment) {
            throw HTTPAppException.InternalError("Failed to save the comment");
        }

        return c.json(
            serializeComment(
                {
                    ...comment,
                    author: {
                        id: user.id,
                        name: user.name,
                        image: user.image ?? null,
                    },
                },
                // The author can always delete their own comment.
                { id: user.id, canManage: false },
            ),
            201,
        );
    },
);

export const deleteWrappedStoryPhotoCommentRoute = route().delete(
    "/:eventId/wrapped/story/photos/:photoId/comments/:commentId",
    describeRoute({
        tags: ["wrapped"],
        summary: "Delete a comment on a photo in the event's story",
        operationId: "deleteWrappedStoryPhotoComment",
        description:
            "Delete a comment. Its author can, and so can an organizer of the event (events:update or events:manage, globally or for the arranging group).",
    })
        .response({ statusCode: 204, description: "Deleted" })
        .unauthorized({ description: "Authentication required" })
        .forbidden({
            description: "Only the author or an organizer can delete it",
        })
        .notFound({ description: "Comment not found" })
        .build(),
    requireAuth,
    validator("param", storyCommentParamSchema),
    async (c) => {
        const ctx = c.get("ctx");
        const user = c.get("user");
        const { eventId, photoId, commentId } = c.req.valid("param");

        await requireStoryPhoto(ctx, eventId, photoId, user.id);

        const comment = await ctx.db.query.wrappedPhotoComment.findFirst({
            where: { id: commentId, photoId },
            columns: { userId: true },
        });
        if (!comment) {
            throw HTTPAppException.NotFound("Comment");
        }
        if (
            comment.userId !== user.id &&
            !(await canActOnEvent(
                ctx,
                user.id,
                eventId,
                WRAPPED_ARRANGER_PERMISSIONS,
            ))
        ) {
            throw HTTPAppException.Forbidden(
                "Only the author or an organizer can delete this comment",
            );
        }

        await ctx.db
            .delete(schema.wrappedPhotoComment)
            .where(eq(schema.wrappedPhotoComment.id, commentId));

        c.get("logger").info(
            {
                eventId,
                photoId,
                commentId,
                byAuthor: comment.userId === user.id,
            },
            "Wrapped story comment deleted",
        );

        return c.body(null, 204);
    },
);
