import {
    type InfiniteData,
    type QueryClient,
    infiniteQueryOptions,
    mutationOptions,
} from "@tanstack/react-query";
import type { components } from "@tihlde/sdk";
import { apiClient } from "#/api/api-client";
import { fetchPrivateObjectUrl } from "#/lib/assets";

/** Storyen etter utvelgelsen (tihlde-wrapped): forsiden og de valgte bildene. */

export type WrappedStory = components["schemas"]["WrappedStory"];
export type WrappedStoryPhoto = components["schemas"]["WrappedStoryPhoto"];
export type WrappedPhotoComment = components["schemas"]["WrappedPhotoComment"];

export const WrappedStoryQueryKeys = {
    story: ["wrapped", "story"] as const,
    comments: ["wrapped", "story", "comments"] as const,
} as const;

const STORY_PAGE_SIZE = 12;

/**
 * Én side om gangen: storyen kan ha hundrevis av bilder, og de fleste ser
 * bare de første. Neste side hentes når man nærmer seg slutten.
 */
export const getWrappedStoryQuery = (eventId: string) =>
    infiniteQueryOptions({
        queryKey: [...WrappedStoryQueryKeys.story, eventId],
        queryFn: ({ pageParam }) =>
            apiClient.get("/api/event/{eventId}/wrapped/story", {
                params: { eventId },
                searchParams: { page: pageParam, pageSize: STORY_PAGE_SIZE },
            }),
        initialPageParam: 0,
        getNextPageParam: (lastPage) => lastPage.nextPage,
    });

/**
 * Bildene er private og krever sesjonen, så de hentes med credentials og
 * vises som object-URL-er. Alltid 1920 px, aldri originalen.
 */
export function fetchWrappedStoryImage(imageUrl: string): Promise<string> {
    return fetchPrivateObjectUrl(`${imageUrl}?w=1920`);
}

type PhotoRef = { eventId: string; photoId: string };

/**
 * Skriver om ett bilde i storyen som allerede er hentet. Brukes i stedet for
 * å invalidere: en invalidering henter alle sidene på nytt, og bildene
 * blinker mens object-URL-ene lages på nytt.
 */
function patchStoryPhoto(
    client: QueryClient,
    { eventId, photoId }: PhotoRef,
    patch: (photo: WrappedStoryPhoto) => WrappedStoryPhoto,
) {
    client.setQueryData<InfiniteData<WrappedStory>>(
        getWrappedStoryQuery(eventId).queryKey,
        (story) =>
            story && {
                ...story,
                pages: story.pages.map((page) => ({
                    ...page,
                    items: page.items.map((photo) =>
                        photo.id === photoId ? patch(photo) : photo,
                    ),
                })),
            },
    );
}

function readStoryPhoto(
    client: QueryClient,
    { eventId, photoId }: PhotoRef,
): WrappedStoryPhoto | undefined {
    return client
        .getQueryData<InfiniteData<WrappedStory>>(
            getWrappedStoryQuery(eventId).queryKey,
        )
        ?.pages.flatMap((page) => page.items)
        .find((photo) => photo.id === photoId);
}

/**
 * Lik eller fjern liken. Vises med en gang og rulles tilbake hvis kallet
 * feiler; svaret har de riktige tallene og skrives inn til slutt.
 */
export const likeWrappedStoryPhotoMutation = mutationOptions({
    mutationFn: ({ eventId, photoId, liked }: PhotoRef & { liked: boolean }) =>
        liked
            ? apiClient.put(
                  "/api/event/{eventId}/wrapped/story/photos/{photoId}/like",
                  { params: { eventId, photoId } },
              )
            : apiClient.delete(
                  "/api/event/{eventId}/wrapped/story/photos/{photoId}/like",
                  { params: { eventId, photoId } },
              ),
    onMutate(vars, ctx) {
        const before = readStoryPhoto(ctx.client, vars);
        patchStoryPhoto(ctx.client, vars, (photo) =>
            photo.likedByMe === vars.liked
                ? photo
                : {
                      ...photo,
                      likedByMe: vars.liked,
                      likeCount: photo.likeCount + (vars.liked ? 1 : -1),
                  },
        );
        return { before };
    },
    onError(_, vars, result, ctx) {
        const before = result?.before;
        if (before) patchStoryPhoto(ctx.client, vars, () => before);
    },
    onSuccess(likes, vars, __, ctx) {
        patchStoryPhoto(ctx.client, vars, (photo) => ({ ...photo, ...likes }));
    },
});

const COMMENT_PAGE_SIZE = 30;

/** Kommentarene på ett bilde, eldste først. */
export const getWrappedStoryCommentsQuery = ({ eventId, photoId }: PhotoRef) =>
    infiniteQueryOptions({
        queryKey: [...WrappedStoryQueryKeys.comments, eventId, photoId],
        queryFn: ({ pageParam }) =>
            apiClient.get(
                "/api/event/{eventId}/wrapped/story/photos/{photoId}/comments",
                {
                    params: { eventId, photoId },
                    searchParams: {
                        page: pageParam,
                        pageSize: COMMENT_PAGE_SIZE,
                    },
                },
            ),
        initialPageParam: 0,
        getNextPageParam: (lastPage) => lastPage.nextPage,
    });

/** Etter en ny eller slettet kommentar: lista og tallet på bildet. */
function afterCommentChange(
    client: QueryClient,
    vars: PhotoRef,
    delta: number,
) {
    patchStoryPhoto(client, vars, (photo) => ({
        ...photo,
        commentCount: Math.max(0, photo.commentCount + delta),
    }));
    return client.invalidateQueries({
        queryKey: getWrappedStoryCommentsQuery(vars).queryKey,
    });
}

export const createWrappedStoryCommentMutation = mutationOptions({
    mutationFn: ({ eventId, photoId, body }: PhotoRef & { body: string }) =>
        apiClient.post(
            "/api/event/{eventId}/wrapped/story/photos/{photoId}/comments",
            { params: { eventId, photoId }, json: { body } },
        ),
    onSuccess(_, vars, __, ctx) {
        return afterCommentChange(ctx.client, vars, 1);
    },
});

export const deleteWrappedStoryCommentMutation = mutationOptions({
    mutationFn: ({
        eventId,
        photoId,
        commentId,
    }: PhotoRef & { commentId: string }) =>
        apiClient.delete(
            "/api/event/{eventId}/wrapped/story/photos/{photoId}/comments/{commentId}",
            { params: { eventId, photoId, commentId } },
        ),
    onSuccess(_, vars, __, ctx) {
        return afterCommentChange(ctx.client, vars, -1);
    },
});
