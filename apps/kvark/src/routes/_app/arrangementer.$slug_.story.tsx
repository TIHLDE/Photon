import {
    Suspense,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { CameraControlButton } from "@tihlde/ui/ui/camera-viewfinder";
import {
    StoryFeed,
    StoryTitle,
    StoryTopBar,
    StoryViewer,
} from "@tihlde/ui/ui/story-viewer";
import { X } from "lucide-react";
import z from "zod";

import { authClientWithRedirect } from "#/api/auth";
import { getEventByIdQuery } from "#/api/queries/events";
import {
    type WrappedStoryPhoto as StoryPhoto,
    fetchWrappedStoryImage,
    getWrappedStoryQuery,
} from "#/api/queries/wrapped-story";
import { WrappedStoryCover } from "#/components/wrapped-story/wrapped-story-cover";
import { WrappedStoryPhoto } from "#/components/wrapped-story/wrapped-story-photo";
import {
    WrappedStorySkeleton,
    WrappedStoryUnavailable,
} from "#/components/wrapped-story/wrapped-story-states";
import { useObjectUrls } from "#/hooks/use-object-urls";
import { errorStatus } from "#/lib/utils";

const searchSchema = z.object({
    /** Bildet man står på, så en omlasting eller delt lenke lander der. */
    bilde: z.uuid().optional().catch(undefined),
});

/**
 * Storyen etter utvelgelsen: /arrangementer/<slug>/story. Varselet deltakerne
 * får når storyen publiseres, lenker hit.
 *
 * `$slug_` og ikke `$slug`: detaljsida har ingen `<Outlet />`, så en nøstet
 * rute ville aldri blitt vist. Sida eier hele skjermen (`immersive`).
 */
export const Route = createFileRoute("/_app/arrangementer/$slug_/story")({
    component: WrappedStoryPage,
    staticData: { immersive: true },
    validateSearch: searchSchema,
    beforeLoad: ({ location }) => authClientWithRedirect(location.href),
    loader: async ({ context, params }) => {
        const event = await context.queryClient.ensureQueryData(
            getEventByIdQuery(params.slug),
        );
        try {
            await context.queryClient.ensureInfiniteQueryData(
                getWrappedStoryQuery(event.id),
            );
            return { eventId: event.id, unavailable: false };
        } catch (error) {
            // Avgjøres her og ikke i en errorComponent: statuskoden overlever
            // ikke hydreringen, bare feilmeldingen gjør det.
            if (errorStatus(error) === 404) {
                return { eventId: event.id, unavailable: true };
            }
            throw error;
        }
    },
});

/** Hvor mange bilder før og etter det man ser på som holdes i minnet. */
const KEEP_BEHIND = 2;
const KEEP_AHEAD = 3;

/** Neste side hentes når så mange bilder er igjen. */
const LOAD_MORE_WHEN_LEFT = 3;

function WrappedStoryPage() {
    const { slug } = Route.useParams();
    const { eventId, unavailable } = Route.useLoaderData();

    const close = (
        <CameraControlButton
            render={<Link to="/arrangementer/$slug" params={{ slug }} />}
            aria-label="Lukk storyen"
        >
            <X />
        </CameraControlButton>
    );

    if (unavailable) {
        return (
            <StoryViewer>
                <StoryTopBar>{close}</StoryTopBar>
                <WrappedStoryUnavailable
                    backLink={
                        <Link to="/arrangementer/$slug" params={{ slug }} />
                    }
                />
            </StoryViewer>
        );
    }

    return (
        <StoryViewer>
            <Suspense
                fallback={
                    <>
                        <StoryTopBar>{close}</StoryTopBar>
                        <WrappedStorySkeleton />
                    </>
                }
            >
                <WrappedStoryFeed eventId={eventId} close={close} />
            </Suspense>
        </StoryViewer>
    );
}

function WrappedStoryFeed({
    eventId,
    close,
}: {
    eventId: string;
    close: ReactNode;
}) {
    const { bilde } = Route.useSearch();
    const navigate = Route.useNavigate();
    const storyQuery = useSuspenseInfiniteQuery(getWrappedStoryQuery(eventId));
    const { hasNextPage, isFetchingNextPage, fetchNextPage } = storyQuery;
    const firstPage = storyQuery.data.pages[0];
    const event = firstPage?.event;
    const totalCount = firstPage?.totalCount ?? 0;

    const photos = useMemo(
        () => storyQuery.data.pages.flatMap((page) => page.items),
        [storyQuery.data],
    );

    const feedRef = useRef<HTMLDivElement>(null);
    // Sida man ser på: 0 er forsiden, 1 er første bilde.
    const [active, setActive] = useState(0);

    const scrollTo = useCallback((index: number, smooth: boolean) => {
        const slide = feedRef.current?.querySelector(
            `[data-story-index="${index}"]`,
        );
        const reduceMotion = window.matchMedia(
            "(prefers-reduced-motion: reduce)",
        ).matches;
        slide?.scrollIntoView({
            block: "start",
            behavior: smooth && !reduceMotion ? "smooth" : "auto",
        });
    }, []);

    // Hvilken side som fyller skjermen. Følger rullingen, så sveip, tastatur
    // og skjermlesere havner alle her.
    useEffect(() => {
        const feed = feedRef.current;
        if (!feed) return;
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (!entry.isIntersecting) continue;
                    const index = Number(
                        (entry.target as HTMLElement).dataset.storyIndex,
                    );
                    if (Number.isInteger(index)) setActive(index);
                }
            },
            { root: feed, threshold: 0.6 },
        );
        for (const slide of feed.querySelectorAll("[data-story-index]")) {
            observer.observe(slide);
        }
        return () => observer.disconnect();
    }, [photos.length]);

    // Lander på bildet i lenken: henter sider til det er funnet, og ruller
    // dit én gang. Finnes det ikke (lenger), starter storyen på forsiden.
    const pendingTarget = useRef(bilde);
    useEffect(() => {
        const target = pendingTarget.current;
        if (!target) return;
        const index = photos.findIndex((photo) => photo.id === target);
        if (index !== -1) {
            pendingTarget.current = undefined;
            scrollTo(index + 1, false);
        } else if (hasNextPage) {
            if (!isFetchingNextPage) void fetchNextPage();
        } else {
            pendingTarget.current = undefined;
        }
    }, [photos, hasNextPage, isFetchingNextPage, fetchNextPage, scrollTo]);

    // Bildet man står på, i adressen. `replace`, så tilbake-knappen går ut
    // av storyen og ikke ett bilde tilbake.
    const activePhotoId = active > 0 ? photos[active - 1]?.id : undefined;
    useEffect(() => {
        if (pendingTarget.current) return;
        void navigate({
            search: { bilde: activePhotoId },
            replace: true,
            resetScroll: false,
        });
    }, [activePhotoId, navigate]);

    useEffect(() => {
        if (
            hasNextPage &&
            !isFetchingNextPage &&
            active >= photos.length - LOAD_MORE_WHEN_LEFT
        ) {
            void fetchNextPage();
        }
    }, [active, photos.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

    // Bare bildene nær det man ser på er hentet; resten frigjøres.
    const nearby = useMemo(
        () =>
            photos
                .slice(
                    Math.max(0, active - 1 - KEEP_BEHIND),
                    Math.max(0, active - 1) + KEEP_AHEAD + 1,
                )
                .map((photo) => photo.imageUrl),
        [photos, active],
    );
    const imageUrls = useObjectUrls(nearby, fetchWrappedStoryImage, {
        releaseDropped: true,
    });

    useEffect(() => {
        feedRef.current?.focus({ preventScroll: true });
    }, []);

    function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
        const next = ["ArrowDown", "PageDown", "j"].includes(event.key);
        const previous = ["ArrowUp", "PageUp", "k"].includes(event.key);
        if (!next && !previous) return;
        event.preventDefault();
        const index = Math.min(
            Math.max(active + (next ? 1 : -1), 0),
            photos.length,
        );
        scrollTo(index, true);
    }

    if (!event) return null;

    return (
        <>
            <StoryTopBar>
                {close}
                <StoryTitle>
                    {active > 0 ? `${active} av ${totalCount}` : event.title}
                </StoryTitle>
            </StoryTopBar>
            <StoryFeed
                ref={feedRef}
                tabIndex={0}
                aria-label={`Wrapped fra ${event.title}`}
                onKeyDown={onKeyDown}
            >
                <WrappedStoryCover
                    title={event.title}
                    start={event.start}
                    imageUrl={event.imageUrl}
                    photoCount={totalCount}
                />
                {photos.map((photo, i) => (
                    <WrappedStoryPhoto
                        key={photo.id}
                        index={i + 1}
                        {...toPhotoData(photo, imageUrls.get(photo.imageUrl))}
                    />
                ))}
            </StoryFeed>
        </>
    );
}

function toPhotoData(photo: StoryPhoto, src: string | null | undefined) {
    return {
        id: photo.id,
        src,
        photographerName: photo.photographer.name,
        photographerImage: photo.photographer.image,
        takenAt: photo.takenAt,
    };
}
