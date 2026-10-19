import {
    type QueryClient,
    mutationOptions,
    queryOptions,
} from "@tanstack/react-query";
import type { components } from "@tihlde/sdk";
import { apiClient } from "#/api/api-client";
import { uploadErrorMessage } from "#/api/queries/assets";
import { fetchPrivateObjectUrl } from "#/lib/assets";

/** Engangskameraet (tihlde-wrapped). */

export type WrappedCameraStatus = components["schemas"]["WrappedCamera"];
export type WrappedCameraReason = NonNullable<WrappedCameraStatus["reason"]>;
export type WrappedUploadResult = components["schemas"]["WrappedPhotoUploaded"];
export type MyWrappedPhoto = components["schemas"]["MyWrappedPhoto"];

const WrappedQueryKeys = {
    camera: ["wrapped", "camera"] as const,
    open: ["wrapped", "open"] as const,
    mine: ["wrapped", "mine"] as const,
} as const;

/**
 * Kameraene den innloggede kan ta bilde med akkurat nå, det mest aktuelle
 * først. Som regel tom.
 *
 * Et kamera åpner og stenger med klokka, uten at noe skjer på sida, så svaret
 * hentes på nytt hvert minutt i tillegg til når fanen får fokus.
 *
 * Nøkkelen bærer brukeren: svaret er personlig, og uten den ville neste
 * medlem som logger inn i samme fane fått se forrige medlems arrangement til
 * et nytt svar var hentet.
 */
export const listOpenWrappedCamerasQuery = (userId: string) =>
    queryOptions({
        queryKey: [...WrappedQueryKeys.open, userId],
        queryFn: () => apiClient.get("/api/event/wrapped/open"),
        staleTime: 0,
        refetchInterval: 60_000,
    });

export const getWrappedCameraQuery = (eventId: string) =>
    queryOptions({
        queryKey: [...WrappedQueryKeys.camera, eventId],
        queryFn: () =>
            apiClient.get("/api/event/{eventId}/wrapped", {
                params: { eventId },
            }),
        // Statusen følger klokka og hvert bilde som tas, så den er aldri
        // «fersk nok» til å vises uten å spørre på nytt.
        staleTime: 0,
    });

/**
 * Den innloggedes egne bilder fra arrangementet, eldste først — utkast og
 * innsendte. Ingen andre ser utkastene.
 */
export const getMyWrappedPhotosQuery = (eventId: string) =>
    queryOptions({
        queryKey: [...WrappedQueryKeys.mine, eventId],
        queryFn: () =>
            apiClient.get("/api/event/{eventId}/wrapped/photos/mine", {
                params: { eventId },
            }),
        // Utkast forsvinner når kameraet stenger, så lista hentes på nytt.
        staleTime: 0,
    });

/**
 * Miniatyren av et eget bilde. Ruta krever sesjonen, så bildet hentes med
 * credentials i stedet for å brukes som `<img src>`.
 */
export function fetchMyWrappedPhotoThumb(path: string): Promise<string> {
    return fetchPrivateObjectUrl(`${path}?w=480`);
}

export function myWrappedPhotoImagePath(eventId: string, photoId: string) {
    return `api/event/${eventId}/wrapped/photos/mine/${photoId}/image`;
}

/** Sender inn alle utkastene på én gang. */
export const submitMyWrappedPhotosMutation = mutationOptions({
    mutationFn: ({ eventId }: { eventId: string }) =>
        apiClient.post("/api/event/{eventId}/wrapped/photos/mine/submit", {
            params: { eventId },
            json: {},
        }),
    onSuccess(_, { eventId }, __, ctx) {
        return invalidateMine(ctx.client, eventId);
    },
});

/** Alt som teller utkast: statusen, lista og snarveien over bunnlinja. */
export function invalidateMine(client: QueryClient, eventId: string) {
    return Promise.all([
        client.invalidateQueries({
            queryKey: [...WrappedQueryKeys.camera, eventId],
        }),
        client.invalidateQueries({
            queryKey: [...WrappedQueryKeys.mine, eventId],
        }),
        client.invalidateQueries({ queryKey: WrappedQueryKeys.open }),
    ]);
}

export const uploadWrappedPhotoMutation = mutationOptions({
    mutationFn: async ({
        eventId,
        file,
        idempotencyKey,
    }: {
        eventId: string;
        file: File;
        /**
         * Én UUID per bilde, den samme i hvert forsøk. Kom svaret aldri fram
         * forrige gang, kjenner API-et igjen bildet og trekker ikke et nytt.
         */
        idempotencyKey: string;
    }): Promise<WrappedUploadResult> => {
        const formData = new FormData();
        formData.append("file", file);
        try {
            return await apiClient.post("/api/event/{eventId}/wrapped/photos", {
                params: { eventId },
                searchParams: { idempotencyKey },
                body: formData,
            } as never);
        } catch (error) {
            // `cause` beholder den opprinnelige feilen, så ruta kan lese
            // statuskoden (403/409 betyr at statusen er utdatert).
            throw new Error(uploadErrorMessage(error, formData), {
                cause: error,
            });
        }
    },
    // Hvert bilde endrer hvor mange som er igjen og havner i Mine bilder.
    // Ruta oppdaterer kamerastatusen selv, med tellerne fra svaret.
    onSuccess(_, { eventId }, ___, ctx) {
        return Promise.all([
            ctx.client.invalidateQueries({ queryKey: WrappedQueryKeys.open }),
            ctx.client.invalidateQueries({
                queryKey: [...WrappedQueryKeys.mine, eventId],
            }),
        ]);
    },
});
