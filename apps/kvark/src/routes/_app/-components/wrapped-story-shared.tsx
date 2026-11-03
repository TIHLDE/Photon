import { useEffect, useMemo, useState } from "react";
import {
    useInfiniteQuery,
    useMutation,
    useSuspenseInfiniteQuery,
} from "@tanstack/react-query";
import { toast } from "@tihlde/ui/ui/sonner";

import {
    type WrappedStoryPhoto as StoryPhoto,
    createWrappedStoryCommentMutation,
    deleteWrappedStoryCommentMutation,
    fetchWrappedStoryImage,
    getWrappedStoryCommentsQuery,
    getWrappedStoryQuery,
    likeWrappedStoryPhotoMutation,
} from "#/api/queries/wrapped-story";
import { WrappedStoryComments } from "#/components/wrapped-story/wrapped-story-comments";
import { useObjectUrls } from "#/hooks/use-object-urls";
import { extractErrorMessage } from "#/lib/api-error";

/**
 * Det storyen som rulles og kortbunken har felles: bildene, likes,
 * kommentarer og hvilke bilder som holdes i minnet. Visningene bestemmer
 * bare hvordan man blar.
 */

/** Ruta storyen ligger på: ID-en for `useSearch`, stien for `useNavigate`. */
export const STORY_ROUTE = "/_app/arrangementer/$slug_/story" as const;
export const STORY_PATH = "/arrangementer/$slug/story" as const;

/** Hvor mange bilder før og etter det man ser på som holdes i minnet. */
const KEEP_BEHIND = 2;
const KEEP_AHEAD = 3;

/** Neste side hentes når så mange bilder er igjen. */
const LOAD_MORE_WHEN_LEFT = 3;

/** Hvor lenge hjertet etter et dobbelttrykk står. */
const HEART_BURST_MS = 800;

/**
 * Om tastetrykket hører til noe annet enn storyen: et skrivefelt, eller et
 * ark eller en dialog som ligger over den.
 */
export function belongsElsewhere(target: EventTarget | null): boolean {
    return (
        target instanceof Element &&
        target.closest(
            'input, textarea, select, [contenteditable="true"], [role="dialog"], [role="alertdialog"]',
        ) !== null
    );
}

/** En tast som bare skal gjelde storyen, ikke nettleseren eller et felt. */
export function isStoryKey(event: KeyboardEvent): boolean {
    return (
        !event.defaultPrevented &&
        !event.altKey &&
        !event.metaKey &&
        !event.ctrlKey &&
        !belongsElsewhere(event.target)
    );
}

/**
 * Storyen og bildene som er hentet så langt. `position` er sida man ser på,
 * med forsiden som 0: neste side hentes når man nærmer seg slutten.
 */
export function useStoryPhotos(eventId: string, position: number) {
    const query = useSuspenseInfiniteQuery(getWrappedStoryQuery(eventId));
    const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
    const firstPage = query.data.pages[0];

    const photos = useMemo(
        () => query.data.pages.flatMap((page) => page.items),
        [query.data],
    );

    useEffect(() => {
        if (
            hasNextPage &&
            !isFetchingNextPage &&
            position >= photos.length - LOAD_MORE_WHEN_LEFT
        ) {
            void fetchNextPage();
        }
    }, [
        position,
        photos.length,
        hasNextPage,
        isFetchingNextPage,
        fetchNextPage,
    ]);

    return {
        event: firstPage?.event,
        layout: firstPage?.layout ?? "feed",
        totalCount: firstPage?.totalCount ?? 0,
        photos,
        hasNextPage,
        isFetchingNextPage,
        fetchNextPage,
    };
}

/** Bare bildene nær det man ser på er hentet; resten frigjøres. */
export function useNearbyImages(
    photos: readonly StoryPhoto[],
    position: number,
) {
    const nearby = useMemo(
        () =>
            photos
                .slice(
                    Math.max(0, position - 1 - KEEP_BEHIND),
                    Math.max(0, position - 1) + KEEP_AHEAD + 1,
                )
                .map((photo) => photo.imageUrl),
        [photos, position],
    );
    return useObjectUrls(nearby, fetchWrappedStoryImage, {
        releaseDropped: true,
    });
}

/** Lik, fjern liken, og hjertet som spilles av ved dobbelttrykk. */
export function useStoryLikes(eventId: string) {
    // Ny nøkkel per dobbelttrykk, så hjertet spilles av på nytt hver gang.
    const [burst, setBurst] = useState<{ photoId: string; key: number } | null>(
        null,
    );
    const like = useMutation({
        ...likeWrappedStoryPhotoMutation,
        onError: async (error) => {
            console.error("Lik av bilde feilet", error);
            toast.error(await extractErrorMessage(error));
        },
    });

    useEffect(() => {
        if (!burst) return;
        const timeout = setTimeout(() => setBurst(null), HEART_BURST_MS);
        return () => clearTimeout(timeout);
    }, [burst]);

    function setLiked(photo: StoryPhoto, liked: boolean) {
        if (photo.likedByMe === liked) return;
        like.mutate({ eventId, photoId: photo.id, liked });
    }

    function doubleTapLike(photo: StoryPhoto) {
        // Et dobbelttrykk liker alltid, som på TikTok — det fjerner aldri.
        setLiked(photo, true);
        setBurst({ photoId: photo.id, key: Date.now() });
    }

    return { burst, setLiked, doubleTapLike };
}

export function toPhotoData(photo: StoryPhoto, src: string | null | undefined) {
    return {
        id: photo.id,
        src,
        photographerName: photo.photographer.name,
        photographerImage: photo.photographer.image,
        takenAt: photo.takenAt,
    };
}

/**
 * Arket med kommentarene på ett bilde. Hentes først når arket åpnes, og
 * bare for det bildet.
 */
export function StoryComments({
    eventId,
    photoId,
    totalCount,
    onClose,
}: {
    eventId: string;
    photoId: string | null;
    totalCount: number;
    onClose: () => void;
}) {
    // Bildet henger igjen mens arket animeres ut, så innholdet ikke
    // forsvinner før arket er borte.
    const [shown, setShown] = useState(photoId);
    if (photoId && photoId !== shown) setShown(photoId);
    const ref = { eventId, photoId: shown ?? "" };

    const comments = useInfiniteQuery({
        ...getWrappedStoryCommentsQuery(ref),
        enabled: shown !== null,
    });
    const [error, setError] = useState<string | null>(null);
    const onError = async (err: Error) => {
        console.error("Kommentaren feilet", err);
        setError(await extractErrorMessage(err));
    };
    const create = useMutation({
        ...createWrappedStoryCommentMutation,
        onError,
    });
    const remove = useMutation({
        ...deleteWrappedStoryCommentMutation,
        onError,
    });

    return (
        <WrappedStoryComments
            open={photoId !== null}
            onOpenChange={(open) => {
                if (open) return;
                setError(null);
                onClose();
            }}
            comments={comments.data?.pages
                .flatMap((page) => page.items)
                .map((comment) => ({
                    id: comment.id,
                    body: comment.body,
                    createdAt: comment.createdAt,
                    authorName: comment.author.name,
                    authorImage: comment.author.image,
                    canDelete: comment.canDelete,
                }))}
            totalCount={totalCount}
            hasMore={comments.hasNextPage}
            isLoadingMore={comments.isFetchingNextPage}
            isSubmitting={create.isPending}
            error={error}
            onLoadMore={() => void comments.fetchNextPage()}
            onSubmit={async (body) => {
                setError(null);
                try {
                    await create.mutateAsync({ ...ref, body });
                    return true;
                } catch {
                    // Feilen vises av `onError` over.
                    return false;
                }
            }}
            onDelete={(commentId) => {
                setError(null);
                remove.mutate({ ...ref, commentId });
            }}
        />
    );
}
