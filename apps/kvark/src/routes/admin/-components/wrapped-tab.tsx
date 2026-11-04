import {
    useMutation,
    useMutationState,
    useSuspenseInfiniteQuery,
    useSuspenseQuery,
} from "@tanstack/react-query";
import { Alert, AlertDescription } from "@tihlde/ui/ui/alert";
import { Button } from "@tihlde/ui/ui/button";
import { Link } from "@tanstack/react-router";
import { Camera, CameraOff, Check, X } from "lucide-react";
import { Suspense, useMemo, useState } from "react";

import { getWrappedCameraQuery } from "#/api/queries/wrapped";
import {
    UPDATE_WRAPPED_PHOTO_KEY,
    type UpdateWrappedPhotoVariables,
    fetchWrappedPhotoLarge,
    fetchWrappedPhotoTile,
    listWrappedPhotosQuery,
    publishWrappedStoryMutation,
    selectAllWrappedPhotosMutation,
    setWrappedCameraMutation,
    unpublishWrappedStoryMutation,
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
import { WrappedStoryPublish } from "#/components/wrapped-story/wrapped-story-publish";
import {
    WrappedPhotoGrid,
    type WrappedPhotoGridFilter,
    type WrappedPhotoTileData,
} from "#/components/wrapped-photo-grid";
import { useObjectUrls } from "#/hooks/use-object-urls";
import { extractErrorMessage } from "#/lib/api-error";
import { formatInOslo } from "#/lib/date";

/**
 * «Kamera»-fanen i arrangementsadminen: innstillingene for engangskameraet og
 * utvalget av bildene deltakerne har tatt (tihlde-wrapped, #869).
 */
export function WrappedTab({
    eventId,
    slug,
}: {
    eventId: string;
    slug: string;
}) {
    return (
        <div className="flex flex-col gap-6">
            <Suspense fallback={<WrappedCameraSettingsSkeleton />}>
                <CameraSettingsSection eventId={eventId} />
            </Suspense>
            <Suspense fallback={<WrappedCameraSettingsSkeleton />}>
                <StoryPublishSection eventId={eventId} slug={slug} />
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

function StoryPublishSection({
    eventId,
    slug,
}: {
    eventId: string;
    slug: string;
}) {
    const { data: camera } = useSuspenseQuery(getWrappedCameraQuery(eventId));
    // Samme liste som rutenettet under, så tallet følger hvert valg.
    const { data: photos } = useSuspenseInfiniteQuery(
        listWrappedPhotosQuery(eventId),
    );
    const [error, setError] = useState<string | null>(null);
    const onError = async (err: Error) => {
        console.error("Publisering av storyen feilet", err);
        setError(await extractErrorMessage(err));
    };
    const publish = useMutation({ ...publishWrappedStoryMutation, onError });
    const setLayout = useMutation({ ...setWrappedCameraMutation, onError });
    const unpublish = useMutation({
        ...unpublishWrappedStoryMutation,
        onError,
    });

    // I en ny fane: storyen lukkes til arrangementssida, ikke til adminen.
    const storyLink = (
        <Link
            to="/arrangementer/$slug/story"
            params={{ slug }}
            target="_blank"
        />
    );

    return (
        <WrappedStoryPublish
            selectedCount={photos.pages[0]?.selectedCount ?? 0}
            publishedAt={camera.publishedAt}
            firstPublishedAt={camera.firstPublishedAt}
            isPending={publish.isPending || unpublish.isPending}
            layout={camera.storyLayout}
            isSavingLayout={setLayout.isPending}
            onLayoutChange={(storyLayout) => {
                setError(null);
                // `enabled` må være med i kallet; det er det som er lagret.
                setLayout.mutate({
                    eventId,
                    data: { enabled: camera.enabled, storyLayout },
                });
            }}
            error={error}
            storyLink={storyLink}
            onPublish={() => {
                setError(null);
                publish.mutate({ eventId });
            }}
            onUnpublish={() => {
                setError(null);
                unpublish.mutate({ eventId });
            }}
        />
    );
}

function PhotosSection({ eventId }: { eventId: string }) {
    const [filter, setFilter] = useState<WrappedPhotoGridFilter>("all");
    return (
        <Suspense key={filter} fallback={<WrappedPhotoGridSkeleton />}>
            <FilteredPhotos
                eventId={eventId}
                filter={filter}
                onFilterChange={setFilter}
            />
        </Suspense>
    );
}

function FilteredPhotos({
    eventId,
    filter,
    onFilterChange,
}: {
    eventId: string;
    filter: WrappedPhotoGridFilter;
    onFilterChange: (filter: WrappedPhotoGridFilter) => void;
}) {
    const { data: camera } = useSuspenseQuery(getWrappedCameraQuery(eventId));
    const photosQuery = useSuspenseInfiniteQuery(
        listWrappedPhotosQuery(eventId, filter),
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

    const selectAll = useMutation({
        ...selectAllWrappedPhotosMutation,
        onError: async (err) => {
            console.error("Marker alle feilet", err);
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
    const imageUrls = useObjectUrls(paths, fetchWrappedPhotoTile);

    // Den store versjonen hentes bare for bildet som faktisk åpnes, ikke for
    // hver flis i rutenettet.
    const openImageUrl = photos.find((photo) => photo.id === openId)?.imageUrl;
    const openPaths = useMemo(
        () => (openImageUrl ? [openImageUrl] : []),
        [openImageUrl],
    );
    const largeUrls = useObjectUrls(openPaths, fetchWrappedPhotoLarge);

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
                description="Bildene deltakerne tar, dukker opp her når kameraet har stengt."
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

    function toggleMany(photoIds: string[], selected: boolean) {
        for (const photoId of photoIds) {
            toggle(photoId, selected);
        }
    }

    // Lightboxen får bare bildene som er hentet; resten har ingen URL ennå.
    // Flisa står inne til den store versjonen er kommet.
    const lightboxPictures: LightboxPicture[] = photos.flatMap((photo) => {
        const src = imageUrls.get(photo.imageUrl);
        if (!src) return [];
        return [
            {
                id: photo.id,
                imageUrl: largeUrls.get(photo.imageUrl) ?? src,
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
                filter={filter}
                onFilterChange={onFilterChange}
                isSelectingAll={selectAll.isPending}
                onSelectAll={(selected) => {
                    setError(null);
                    selectAll.mutate({ eventId, selected });
                }}
                onToggle={toggleMany}
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
