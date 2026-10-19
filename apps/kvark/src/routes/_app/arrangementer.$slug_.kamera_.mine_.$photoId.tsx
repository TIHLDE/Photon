import {
    Suspense,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    Link,
    Navigate,
    createFileRoute,
    useNavigate,
} from "@tanstack/react-router";
import {
    useMutation,
    useQueryClient,
    useSuspenseQuery,
} from "@tanstack/react-query";
import { CameraScreen } from "@tihlde/ui/ui/camera-viewfinder";
import type { CarouselApi } from "@tihlde/ui/ui/carousel";
import { toast } from "@tihlde/ui/ui/sonner";
import { Spinner } from "@tihlde/ui/ui/spinner";

import { authClientWithRedirect } from "#/api/auth";
import { getEventByIdQuery } from "#/api/queries/events";
import {
    deleteMyWrappedPhotoMutation,
    fetchMyWrappedPhotoLarge,
    getMyWrappedPhotosQuery,
    myWrappedPhotoImagePath,
} from "#/api/queries/wrapped";
import {
    WrappedPhotoReview,
    type WrappedReviewPhoto,
} from "#/components/wrapped-photo-review";
import { useObjectUrls } from "#/hooks/use-object-urls";
import { extractErrorMessage } from "#/lib/api-error";

/**
 * Egne bilder i full skjerm: /arrangementer/<slug>/kamera/mine/<photoId>.
 *
 * `mine_` og ikke `mine`: Mine bilder har ingen `<Outlet />`. Egen rute og
 * ikke en tilstand på Mine bilder, fordi sida eier hele skjermen
 * (`immersive`), og det settes per rute.
 */
export const Route = createFileRoute(
    "/_app/arrangementer/$slug_/kamera_/mine_/$photoId",
)({
    component: WrappedPhotoReviewPage,
    staticData: { immersive: true },
    beforeLoad: ({ location }) => authClientWithRedirect(location.href),
    loader: async ({ context, params }) => {
        const event = await context.queryClient.ensureQueryData(
            getEventByIdQuery(params.slug),
        );
        await context.queryClient.ensureQueryData(
            getMyWrappedPhotosQuery(event.id),
        );
    },
});

function WrappedPhotoReviewPage() {
    const { slug, photoId } = Route.useParams();

    return (
        <Suspense
            fallback={
                <CameraScreen className="flex items-center justify-center">
                    <Spinner className="size-8" />
                </CameraScreen>
            }
        >
            <WrappedPhotoReviewContainer slug={slug} photoId={photoId} />
        </Suspense>
    );
}

/** Hvor lenge «Angre» står før slettingen sendes. */
const UNDO_MS = 5000;

function WrappedPhotoReviewContainer({
    slug,
    photoId,
}: {
    slug: string;
    photoId: string;
}) {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { data: event } = useSuspenseQuery(getEventByIdQuery(slug));
    const { data: photos } = useSuspenseQuery(
        getMyWrappedPhotosQuery(event.id),
    );
    const deletePhoto = useMutation(deleteMyWrappedPhotoMutation);

    // Bildet som er slettet, men ikke sendt ennå. «Angre» virker bare fordi
    // DELETE ikke er sendt: den sendes når toasten går ut, når et nytt bilde
    // slettes, eller når skjermen forlates.
    const [pendingId, setPendingId] = useState<string | null>(null);
    const pendingRef = useRef<string | null>(null);
    const [currentId, setCurrentId] = useState(photoId);

    // Rekkefølgen fra serveren, eldste først, uten bildet som venter.
    const visible = useMemo(
        () => photos.filter((photo) => photo.id !== pendingId),
        [photos, pendingId],
    );
    const paths = useMemo(
        () =>
            photos.map((photo) => myWrappedPhotoImagePath(event.id, photo.id)),
        [photos, event.id],
    );
    const images = useObjectUrls(paths, fetchMyWrappedPhotoLarge);
    const reviewPhotos: WrappedReviewPhoto[] = visible.map((photo) => ({
        id: photo.id,
        src: images.get(myWrappedPhotoImagePath(event.id, photo.id)),
        fromCameraRoll: photo.source === "camera_roll",
        submitted: photo.submitted,
    }));
    const found = visible.findIndex((photo) => photo.id === currentId);
    const index = Math.max(found, 0);
    const [startIndex] = useState(index);

    const [api, setApi] = useState<CarouselApi>();
    const deleteRef = useRef<HTMLButtonElement>(null);
    const keepRef = useRef<HTMLButtonElement>(null);

    // Sveip og knapper flytter karusellen; den sier fra hvilket bilde som vises.
    useEffect(() => {
        if (!api) return;
        const onSelect = () => {
            const photo = visible[api.selectedScrollSnap()];
            if (photo) setCurrentId(photo.id);
        };
        api.on("select", onSelect);
        return () => {
            api.off("select", onSelect);
        };
    }, [api, visible]);
    // Etter en sletting eller angring flyttes bildene, så karusellen følger
    // bildet, ikke plassen.
    useEffect(() => {
        if (api && api.selectedScrollSnap() !== index) {
            api.scrollTo(index, true);
        }
    }, [api, index, visible]);

    /**
     * Sender slettingen som venter. `replaced`: et nytt bilde slettes, og
     * den nye toasten tar over. `left`: skjermen forlates, og «Angre» fjernes
     * fra toasten, siden det er for sent.
     */
    function flush(id: string, reason?: "replaced" | "left") {
        if (pendingRef.current !== id) return;
        pendingRef.current = null;
        if (reason === "replaced") toast.dismiss(id);
        if (reason === "left") {
            toast("Bilde slettet", {
                id,
                description: "Du fikk bildet tilbake",
                action: undefined,
            });
        }
        // Ute av lista med en gang, så Mine bilder ikke viser det et øyeblikk
        // mens slettingen er på vei.
        queryClient.setQueryData(
            getMyWrappedPhotosQuery(event.id).queryKey,
            (list) => list?.filter((photo) => photo.id !== id),
        );
        deletePhoto
            .mutateAsync({ eventId: event.id, photoId: id })
            .catch(async (error: unknown) => {
                console.error("Sletting av kamerabilde feilet", error);
                // Bildet finnes fortsatt, så det vises igjen.
                setPendingId((pending) => (pending === id ? null : pending));
                toast.error(await extractErrorMessage(error));
            });
    }
    const flushRef = useRef(flush);
    useEffect(() => {
        flushRef.current = flush;
    });

    // Den som går fra skjermen eller lukker fanen, har sagt ja til slettingen.
    useEffect(() => {
        const flushPending = () => {
            if (pendingRef.current) {
                flushRef.current(pendingRef.current, "left");
            }
        };
        const onVisibility = () => {
            if (document.visibilityState === "hidden") flushPending();
        };
        window.addEventListener("pagehide", flushPending);
        document.addEventListener("visibilitychange", onVisibility);
        return () => {
            window.removeEventListener("pagehide", flushPending);
            document.removeEventListener("visibilitychange", onVisibility);
            flushPending();
        };
    }, []);

    const close = useCallback(
        () =>
            void navigate({
                to: "/arrangementer/$slug/kamera/mine",
                params: { slug },
            }),
        [navigate, slug],
    );

    function undo(id: string) {
        if (pendingRef.current !== id) return;
        pendingRef.current = null;
        setPendingId(null);
        setCurrentId(id);
    }

    function handleDelete() {
        const photo = visible[index];
        if (!photo || photo.submitted) return;
        // Bare én sletting venter om gangen.
        if (pendingRef.current) flush(pendingRef.current, "replaced");

        const next = visible[index + 1] ?? visible[index - 1];
        pendingRef.current = photo.id;
        setPendingId(photo.id);
        toast("Bilde slettet", {
            id: photo.id,
            description: "Du fikk bildet tilbake",
            duration: UNDO_MS,
            action: { label: "Angre", onClick: () => undo(photo.id) },
            onAutoClose: () => flush(photo.id),
            onDismiss: () => flush(photo.id),
        });

        if (!next) {
            close();
            return;
        }
        setCurrentId(next.id);
        // Slett-knappen forsvinner når neste bilde er sendt inn.
        requestAnimationFrame(() =>
            (deleteRef.current ?? keepRef.current)?.focus(),
        );
    }

    // Piltaster og Escape på tastatur. Karusellen tar piltastene selv når
    // fokus er inni den.
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.defaultPrevented) return;
            if (e.key === "ArrowLeft") api?.scrollPrev();
            else if (e.key === "ArrowRight") api?.scrollNext();
            else if (e.key === "Escape") close();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [api, close]);

    if (visible.length === 0) {
        return (
            <Navigate to="/arrangementer/$slug/kamera/mine" params={{ slug }} />
        );
    }

    return (
        <WrappedPhotoReview
            photos={reviewPhotos}
            index={index}
            startIndex={startIndex}
            setApi={setApi}
            onPrevious={() => api?.scrollPrev()}
            onNext={() => api?.scrollNext()}
            onDelete={handleDelete}
            closeLink={
                <Link to="/arrangementer/$slug/kamera/mine" params={{ slug }} />
            }
            deleteRef={deleteRef}
            keepRef={keepRef}
        />
    );
}
