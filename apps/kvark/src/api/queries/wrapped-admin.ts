import { infiniteQueryOptions, mutationOptions } from "@tanstack/react-query";
import {
    getWrappedCameraQuery,
    type WrappedCameraStatus,
} from "#/api/queries/wrapped";
import {
    mockListPhotos,
    mockPhotoImage,
    mockSetCamera,
    mockUpdatePhoto,
} from "#/api/queries/wrapped-mock";

/**
 * Organisatorens side av engangskameraet: innstillinger og utvalg. Formen
 * følger kontrakten i #865.
 *
 * TODO(#867): `queryFn`/`mutationFn` går mot stand-ins i `wrapped-mock.ts`.
 * Når `@tihlde/sdk` har rutene, byttes de til `apiClient`, typene under til
 * `@tihlde/sdk`, og `fetchWrappedPhotoImage` til `fetchPrivateObjectUrl`.
 */

export type SetWrappedCamera = {
    enabled: boolean;
    shotsPerPerson?: number;
};

export type WrappedPhoto = {
    id: string;
    createdAt: string;
    selected: boolean;
    uploadedBy: { id: string; name: string };
    /** Sti på API-et som krever sesjonen — ikke en offentlig asset-URL. */
    imageUrl: string;
};

export type WrappedPhotoList = {
    totalCount: number;
    pages: number;
    nextPage: number | null;
    selectedCount: number;
    items: WrappedPhoto[];
};

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
 * Bildene tatt på et arrangement, eldste først (se #865): nye bilder havner
 * nederst i stedet for å stokke om rutenettet mens organisatoren ser på det.
 */
export const listWrappedPhotosQuery = (
    eventId: string,
    pageSize: number = PHOTO_PAGE_SIZE,
) =>
    infiniteQueryOptions({
        queryKey: [...WrappedAdminQueryKeys.photos, eventId, pageSize],
        queryFn: ({ pageParam }) =>
            mockListPhotos(eventId, pageParam, pageSize),
        initialPageParam: 0,
        getNextPageParam: (lastPage) => lastPage.nextPage,
    });

export const setWrappedCameraMutation = mutationOptions({
    mutationFn: ({
        data,
    }: {
        eventId: string;
        data: SetWrappedCamera;
    }): Promise<WrappedCameraStatus> => mockSetCamera(data),
    onSuccess(_, vars, __, ctx) {
        return Promise.all([
            ctx.client.invalidateQueries(getWrappedCameraQuery(vars.eventId)),
            ctx.client.invalidateQueries({
                queryKey: [...WrappedAdminQueryKeys.photos, vars.eventId],
            }),
        ]);
    },
});

/**
 * Nøkkelen lar fanen lese hvilke bilder som er underveis med
 * `useMutationState`, så et trykk vises med en gang uten å skrive i cachen.
 */
export const updateWrappedPhotoMutation = mutationOptions({
    mutationKey: WrappedAdminQueryKeys.updatePhoto,
    mutationFn: ({
        eventId,
        photoId,
        selected,
    }: UpdateWrappedPhotoVariables): Promise<WrappedPhoto> =>
        mockUpdatePhoto(eventId, photoId, selected),
    onSuccess(_, vars, __, ctx) {
        return Promise.all([
            ctx.client.invalidateQueries({
                queryKey: [...WrappedAdminQueryKeys.photos, vars.eventId],
            }),
            ctx.client.invalidateQueries(getWrappedCameraQuery(vars.eventId)),
        ]);
    },
});

export const UPDATE_WRAPPED_PHOTO_KEY = WrappedAdminQueryKeys.updatePhoto;

/**
 * Bildene er private og serveres bare av organisatorens bilderute, som krever
 * sesjonen. De hentes derfor med credentials og vises som object-URL-er.
 * Kalleren må `revokeObjectURL` når den er ferdig.
 */
export function fetchWrappedPhotoImage(imageUrl: string): Promise<string> {
    return mockPhotoImage(imageUrl);
}
