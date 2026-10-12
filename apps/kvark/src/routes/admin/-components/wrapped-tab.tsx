import {
    useMutation,
    useMutationState,
    useSuspenseInfiniteQuery,
    useSuspenseQuery,
} from "@tanstack/react-query";
import { Alert, AlertDescription } from "@tihlde/ui/ui/alert";
import { Button } from "@tihlde/ui/ui/button";
import { Camera, CameraOff, Check, X } from "lucide-react";
import { Suspense, useMemo, useState } from "react";

import { getWrappedCameraQuery } from "#/api/queries/wrapped";
import {
    UPDATE_WRAPPED_PHOTO_KEY,
    type UpdateWrappedPhotoVariables,
    fetchWrappedPhotoImage,
    listWrappedPhotosQuery,
    setWrappedCameraMutation,
    updateWrappedPhotoMutation,
} from "#/api/queries/wrapped-admin";
import { AdminEmptyState } from "#/components/admin-empty-state";
import {
    GalleryLightbox,
    type LightboxPicture,
} from "#/components/gallery-lightbox";
import {
    WrappedCameraSettingsSkeleton,
    WrappedPhotoGridSkeleton,
} from "#/components/wrapped-admin-skeleton";
import { WrappedCameraSettings } from "#/components/wrapped-camera-settings";
import {
    WrappedPhotoGrid,
    type WrappedPhotoTileData,
} from "#/components/wrapped-photo-grid";
import { useObjectUrls } from "#/hooks/use-object-urls";
import { extractErrorMessage } from "#/lib/api-error";
import { formatInOslo } from "#/lib/date";

/**
 * «Kamera»-fanen i arrangementsadminen: innstillingene for engangskameraet og
 * utvalget av bildene deltakerne har tatt (tihlde-wrapped, #869).
 */
export function WrappedTab({ eventId }: { eventId: string }) {
    return (
        <div className="flex flex-col gap-6">
            <Suspense fallback={<WrappedCameraSettingsSkeleton />}>
                <CameraSettingsSection eventId={eventId} />
            </Suspense>
            <Suspense fallback={<WrappedPhotoGridSkeleton />}>
                <PhotosSection eventId={eventId} />
            </Suspense>
        </div>
    );
}

function CameraSettingsSection({ eventId }: { eventId: string }) {
    const { data: camera } = useSuspenseQuery(getWrappedCameraQuery(eventId));
    const setCamera = useMutation(setWrappedCameraMutation);
    const [error, setError] = useState<string | null>(null);

    return (
        <WrappedCameraSettings
            // Ny nøkkel når de lagrede verdiene endres, så utkastet starter
            // fra det som faktisk er lagret.
            key={`${camera.enabled}:${camera.shotsPerPerson}`}
            enabled={camera.enabled}
            shotsPerPerson={camera.shotsPerPerson}
            opensAt={camera.opensAt}
            closesAt={camera.closesAt}
            isSaving={setCamera.isPending}
            error={error}
            onSave={(data) => {
                setError(null);
                setCamera.mutate(
                    { eventId, data },
                    {
                        onError: async (err) => {
                            console.error(
                                "Lagring av kamerainnstillinger feilet",
                                err,
                            );
                            setError(await extractErrorMessage(err));
                        },
                    },
                );
            }}
        />
    );
}

function PhotosSection({ eventId }: { eventId: string }) {
    const { data: camera } = useSuspenseQuery(getWrappedCameraQuery(eventId));
    const photosQuery = useSuspenseInfiniteQuery(
        listWrappedPhotosQuery(eventId),
    );
    const [error, setError] = useState<string | null>(null);
    const [openId, setOpenId] = useState<string | null>(null);

    // Feilen settes i `useMutation`-opsjonene, ikke i `mutate`: med flere
    // trykk underveis kaller TanStack bare `mutate`-callbacken til det siste.
    const updatePhoto = useMutation({
        ...updateWrappedPhotoMutation,
        onError: async (err) => {
            console.error("Valg av bilde feilet", err);
            setError(await extractErrorMessage(err));
        },
    });

    // Trykk som er underveis vises med en gang. Når svaret kommer, skriver
    // mutasjonen det inn i lista i samme øyeblikk som den slutter å være
    // pending, så bildet blinker ikke tilbake i mellomtiden.
    const pending = useMutationState({
        filters: { mutationKey: UPDATE_WRAPPED_PHOTO_KEY, status: "pending" },
        select: (mutation) =>
            mutation.state.variables as UpdateWrappedPhotoVariables,
    });

    const photos = useMemo(
        () => photosQuery.data.pages.flatMap((page) => page.items),
        [photosQuery.data],
    );
    const paths = useMemo(
        () => photos.map((photo) => photo.imageUrl),
        [photos],
    );
    const imageUrls = useObjectUrls(paths, fetchWrappedPhotoImage);

    // Siste trykk per bilde vinner.
    const pendingSelection = new Map(
        pending
            .filter((vars) => vars.eventId === eventId)
            .map((vars) => [vars.photoId, vars.selected]),
    );

    const tiles: WrappedPhotoTileData[] = photos.map((photo) => ({
        id: photo.id,
        src: imageUrls.get(photo.imageUrl),
        uploaderName: photo.uploadedBy.name,
        selected: pendingSelection.get(photo.id) ?? photo.selected,
    }));

    const firstPage = photosQuery.data.pages[0];
    const totalCount = firstPage?.totalCount ?? 0;
    const selectedCount =
        (firstPage?.selectedCount ?? 0) +
        photos.reduce((delta, photo) => {
            const next = pendingSelection.get(photo.id);
            if (next === undefined || next === photo.selected) return delta;
            return delta + (next ? 1 : -1);
        }, 0);

    if (totalCount === 0) {
        return camera.enabled ? (
            <AdminEmptyState
                icon={Camera}
                title="Ingen bilder ennå"
                description="Bildene deltakerne tar, dukker opp her etter hvert."
            />
        ) : (
            <AdminEmptyState
                icon={CameraOff}
                title="Kameraet er av"
                description="Slå på kameraet over, så kan deltakerne ta bilder."
            />
        );
    }

    function toggle(photoId: string, selected: boolean) {
        setError(null);
        updatePhoto.mutate({ eventId, photoId, selected });
    }

    // Lightboxen får bare bildene som er hentet; resten har ingen URL ennå.
    const lightboxPictures: LightboxPicture[] = photos.flatMap((photo) => {
        const src = imageUrls.get(photo.imageUrl);
        if (!src) return [];
        return [
            {
                id: photo.id,
                imageUrl: src,
                imageAlt: `Bilde fra ${photo.uploadedBy.name}`,
                title: photo.uploadedBy.name,
                description: `Tatt ${formatInOslo(photo.createdAt, "d. MMM yyyy 'kl.' HH:mm")}`,
            },
        ];
    });
    const openIndex = lightboxPictures.findIndex((p) => p.id === openId);
    const selectedById = new Map(tiles.map((t) => [t.id, t.selected]));

    return (
        <div className="flex flex-col gap-4">
            {error ? (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            ) : null}
            <WrappedPhotoGrid
                photos={tiles}
                selectedCount={selectedCount}
                totalCount={totalCount}
                hasMore={photosQuery.hasNextPage}
                isLoadingMore={photosQuery.isFetchingNextPage}
                onToggle={toggle}
                onOpen={setOpenId}
                onLoadMore={() => void photosQuery.fetchNextPage()}
            />
            <GalleryLightbox
                pictures={lightboxPictures}
                openIndex={openIndex === -1 ? null : openIndex}
                onOpenChange={(index) =>
                    setOpenId(
                        index === null
                            ? null
                            : (lightboxPictures[index]?.id ?? null),
                    )
                }
                renderActions={(picture) => {
                    const selected = selectedById.get(picture.id) ?? false;
                    return (
                        <Button
                            variant={selected ? "outline" : "default"}
                            size="sm"
                            onClick={() => toggle(picture.id, !selected)}
                        >
                            {selected ? <X /> : <Check />}
                            {selected ? "Fjern fra utvalget" : "Velg"}
                        </Button>
                    );
                }}
            />
        </div>
    );
}
