import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
    StoryCardArea,
    StoryHeartBurst,
    StoryTitle,
    StoryTopBar,
} from "@tihlde/ui/ui/story-viewer";
import { SwipeCardStack } from "@tihlde/ui/ui/swipe-card-stack";

import { WrappedStoryActions } from "#/components/wrapped-story/wrapped-story-actions";
import { WrappedStoryCover } from "#/components/wrapped-story/wrapped-story-cover";
import { WrappedStoryPhoto } from "#/components/wrapped-story/wrapped-story-photo";

import {
    STORY_PATH,
    STORY_ROUTE,
    StoryComments,
    isStoryKey,
    toPhotoData,
    useNearbyImages,
    useStoryLikes,
    useStoryPhotos,
} from "./wrapped-story-shared";

/**
 * Storyen som en kortbunke: sveip til høyre for neste bilde, til venstre for
 * forrige. Arrangøren velger denne eller storyen som rulles i adminen.
 */
export function WrappedStoryCards({
    eventId,
    close,
}: {
    eventId: string;
    close: ReactNode;
}) {
    const { bilde } = useSearch({ from: STORY_ROUTE });
    const navigate = useNavigate({ from: STORY_PATH });
    // Kortet øverst: 0 er forsiden, 1 er første bilde.
    const [index, setIndex] = useState(0);
    const [commentsFor, setCommentsFor] = useState<string | null>(null);

    const {
        event,
        totalCount,
        photos,
        hasNextPage,
        isFetchingNextPage,
        fetchNextPage,
    } = useStoryPhotos(eventId, index);
    const imageUrls = useNearbyImages(photos, index);
    const { burst, setLiked, doubleTapLike } = useStoryLikes(eventId);

    // Lander på bildet i lenken: henter sider til det er funnet. Finnes det
    // ikke (lenger), starter storyen på forsiden.
    const pendingTarget = useRef(bilde);
    useEffect(() => {
        const target = pendingTarget.current;
        if (!target) return;
        const found = photos.findIndex((photo) => photo.id === target);
        if (found !== -1) {
            pendingTarget.current = undefined;
            setIndex(found + 1);
        } else if (hasNextPage) {
            if (!isFetchingNextPage) void fetchNextPage();
        } else {
            pendingTarget.current = undefined;
        }
    }, [photos, hasNextPage, isFetchingNextPage, fetchNextPage]);

    // Bildet man står på, i adressen, som i storyen som rulles.
    const activePhotoId = index > 0 ? photos[index - 1]?.id : undefined;
    useEffect(() => {
        if (pendingTarget.current) return;
        void navigate({
            search: { bilde: activePhotoId },
            replace: true,
            resetScroll: false,
        });
    }, [activePhotoId, navigate]);

    const last = photos.length;
    useEffect(() => {
        function onKeyDown(keyEvent: KeyboardEvent) {
            if (!isStoryKey(keyEvent)) return;
            const next = ["ArrowRight", "PageDown", "l"].includes(keyEvent.key);
            const previous = ["ArrowLeft", "PageUp", "h"].includes(
                keyEvent.key,
            );
            if (!next && !previous) return;
            keyEvent.preventDefault();
            setIndex((current) =>
                Math.min(Math.max(current + (next ? 1 : -1), 0), last),
            );
        }
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [last]);

    if (!event) return null;

    const cards = [
        <WrappedStoryCover
            key="cover"
            variant="card"
            title={event.title}
            start={event.start}
            imageUrl={event.imageUrl}
            photoCount={totalCount}
            onNext={() => setIndex(1)}
        />,
        ...photos.map((photo, i) => (
            <WrappedStoryPhoto
                key={photo.id}
                variant="card"
                index={i + 1}
                {...toPhotoData(photo, imageUrls.get(photo.imageUrl))}
                onDoubleTap={() => doubleTapLike(photo)}
                overlay={
                    burst?.photoId === photo.id ? (
                        <StoryHeartBurst key={burst.key} />
                    ) : null
                }
                actions={
                    <WrappedStoryActions
                        likeCount={photo.likeCount}
                        likedByMe={photo.likedByMe}
                        commentCount={photo.commentCount}
                        onToggleLike={() => setLiked(photo, !photo.likedByMe)}
                        onOpenComments={() => setCommentsFor(photo.id)}
                    />
                }
            />
        )),
    ];

    return (
        <>
            <StoryTopBar>
                {close}
                <StoryTitle>
                    {index > 0 ? `${index} av ${totalCount}` : event.title}
                </StoryTitle>
            </StoryTopBar>
            <StoryCardArea>
                <SwipeCardStack
                    aria-label={`Wrapped fra ${event.title}`}
                    aria-roledescription="kortbunke"
                    cards={cards}
                    index={index}
                    onIndexChange={setIndex}
                />
            </StoryCardArea>
            <StoryComments
                eventId={eventId}
                photoId={commentsFor}
                totalCount={
                    photos.find((photo) => photo.id === commentsFor)
                        ?.commentCount ?? 0
                }
                onClose={() => setCommentsFor(null)}
            />
        </>
    );
}
