import {
    type InfiniteData,
    infiniteQueryOptions,
    mutationOptions,
} from "@tanstack/react-query";
import type { components } from "@tihlde/sdk";
import { apiClient } from "#/api/api-client";
import { getWrappedCameraQuery } from "#/api/queries/wrapped";
import { fetchPrivateObjectUrl } from "#/lib/assets";

/** Organisatorens side av engangskameraet: innstillinger og utvalg. */

export type SetWrappedCamera = components["schemas"]["SetWrappedCamera"];
export type WrappedPhoto = components["schemas"]["WrappedPhoto"];
export type WrappedPhotoList = components["schemas"]["WrappedPhotoList"];

export type UpdateWrappedPhotoVariables = {
    eventId: string;
    photoId: string;
    selected: boolean;
};

const WrappedAdminQueryKeys = {
    photos: ["wrapped", "photos"] as const,
    updatePhoto: ["wrapped", "photos", "update"] as const,
} as const;

const PHOTO_PAGE_SIZE = 24;

/**
 * Bildene tatt på et arrangement, eldste først: nye bilder havner nederst i
 * stedet for å stokke om rutenettet mens organisatoren ser på det.
 */
export const listWrappedPhotosQuery = (
    eventId: string,
    pageSize: number = PHOTO_PAGE_SIZE,
) =>
    infiniteQueryOptions({
        queryKey: [...WrappedAdminQueryKeys.photos, eventId, pageSize],
        queryFn: ({ pageParam }) =>
            apiClient.get("/api/event/{eventId}/wrapped/photos", {
                params: { eventId },
                searchParams: { page: pageParam, pageSize },
            }),
        initialPageParam: 0,
        getNextPageParam: (lastPage) => lastPage.nextPage,
        // Arrangøren følger med mens bildene kommer inn, så lista hentes på
        // nytt hver gang fanen åpnes eller får fokus.
        staleTime: 0,
    });

export const setWrappedCameraMutation = mutationOptions({
    mutationFn: ({
        eventId,
        data,
    }: {
        eventId: string;
        data: SetWrappedCamera;
    }) =>
        apiClient.put("/api/event/{eventId}/wrapped", {
            params: { eventId },
            json: data,
        }),
    onSuccess(_, vars, __, ctx) {
        return ctx.client.invalidateQueries(
            getWrappedCameraQuery(vars.eventId),
        );
    },
});

/**
 * Nøkkelen lar fanen lese hvilke bilder som er underveis med
 * `useMutationState`, så et trykk vises med en gang.
 *
 * Svaret skrives rett inn i lista i stedet for å invalidere den: en
 * invalidering henter alle sidene som er lastet på nytt, og på et stort
 * arrangement er det et tjuetalls kall for hvert eneste trykk.
 */
export const updateWrappedPhotoMutation = mutationOptions({
    mutationKey: WrappedAdminQueryKeys.updatePhoto,
    mutationFn: ({ eventId, photoId, selected }: UpdateWrappedPhotoVariables) =>
        apiClient.patch("/api/event/{eventId}/wrapped/photos/{photoId}", {
            params: { eventId, photoId },
            json: { selected },
        }),
    onSuccess(updated, vars, __, ctx) {
        ctx.client.setQueriesData<InfiniteData<WrappedPhotoList>>(
            { queryKey: [...WrappedAdminQueryKeys.photos, vars.eventId] },
            (list) => {
                if (!list) return list;

                const before = list.pages
                    .flatMap((page) => page.items)
                    .find((photo) => photo.id === updated.id);
                const delta =
                    before && before.selected !== updated.selected
                        ? updated.selected
                            ? 1
                            : -1
                        : 0;

                return {
                    ...list,
                    pages: list.pages.map((page) => ({
                        ...page,
                        selectedCount: page.selectedCount + delta,
                        items: page.items.map((photo) =>
                            photo.id === updated.id ? updated : photo,
                        ),
                    })),
                };
            },
        );
    },
});

export const UPDATE_WRAPPED_PHOTO_KEY = WrappedAdminQueryKeys.updatePhoto;

/**
 * Bildene er private og serveres bare av organisatorens bilderute, som krever
 * sesjonen. De hentes derfor med credentials og vises som object-URL-er.
 * Kalleren må `revokeObjectURL` når den er ferdig.
 *
 * Aldri originalen: rutenettet får en flis på 480 px og lysboksen 1920 px.
 * Tusen bilder i full størrelse er flere hundre megabyte på en telefon.
 */
export function fetchWrappedPhotoTile(imageUrl: string): Promise<string> {
    return fetchPrivateObjectUrl(`${imageUrl}?w=480`);
}

export function fetchWrappedPhotoLarge(imageUrl: string): Promise<string> {
    return fetchPrivateObjectUrl(`${imageUrl}?w=1920`);
}
