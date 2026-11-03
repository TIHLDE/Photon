import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import type z from "zod";
import type { AppContext } from "~/lib/ctx";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { readPhotoStats, requireStoryPhoto } from "~/lib/wrapped/story";
import { requireAuth } from "~/middleware/auth";
import { photoParamSchema, wrappedPhotoLikesSchema } from "./schema";

/** The answer to both like routes, so kvark can update without a refetch. */
async function likesOf(
    db: AppContext["db"],
    photoId: string,
    userId: string,
): Promise<z.infer<typeof wrappedPhotoLikesSchema>> {
    const stats = (await readPhotoStats(db, [photoId], userId)).get(photoId);
    return {
        likeCount: stats?.likeCount ?? 0,
        likedByMe: stats?.likedByMe ?? false,
    };
}

export const likeWrappedStoryPhotoRoute = route().put(
    "/:eventId/wrapped/story/photos/:photoId/like",
    describeRoute({
        tags: ["wrapped"],
        summary: "Like a photo in the event's story",
        operationId: "likeWrappedStoryPhoto",
        description:
            "Like one photo of a story the caller can read. Liking a photo twice is the same as once.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: wrappedPhotoLikesSchema,
            description: "OK",
        })
        .unauthorized({ description: "Authentication required" })
        .notFound({ description: "Photo not found" })
        .build(),
    requireAuth,
    validator("param", photoParamSchema),
    async (c) => {
        const ctx = c.get("ctx");
        const user = c.get("user");
        const { eventId, photoId } = c.req.valid("param");

        await requireStoryPhoto(ctx, eventId, photoId, user.id);
        await ctx.db
            .insert(schema.wrappedPhotoLike)
            .values({ photoId, userId: user.id })
            .onConflictDoNothing();

        return c.json(await likesOf(ctx.db, photoId, user.id));
    },
);

export const unlikeWrappedStoryPhotoRoute = route().delete(
    "/:eventId/wrapped/story/photos/:photoId/like",
    describeRoute({
        tags: ["wrapped"],
        summary: "Remove a like from a photo in the event's story",
        operationId: "unlikeWrappedStoryPhoto",
        description:
            "Take back the caller's like. Removing a like that is not there is not an error.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: wrappedPhotoLikesSchema,
            description: "OK",
        })
        .unauthorized({ description: "Authentication required" })
        .notFound({ description: "Photo not found" })
        .build(),
    requireAuth,
    validator("param", photoParamSchema),
    async (c) => {
        const ctx = c.get("ctx");
        const user = c.get("user");
        const { eventId, photoId } = c.req.valid("param");

        await requireStoryPhoto(ctx, eventId, photoId, user.id);
        await ctx.db
            .delete(schema.wrappedPhotoLike)
            .where(
                and(
                    eq(schema.wrappedPhotoLike.photoId, photoId),
                    eq(schema.wrappedPhotoLike.userId, user.id),
                ),
            );

        return c.json(await likesOf(ctx.db, photoId, user.id));
    },
);
