import { mutationOptions, queryOptions } from "@tanstack/react-query";
import type { components } from "@tihlde/sdk";
import { apiClient } from "#/api/api-client";
import { uploadErrorMessage } from "#/api/queries/assets";

/** Engangskameraet (tihlde-wrapped). */

export type WrappedCameraStatus = components["schemas"]["WrappedCamera"];
export type WrappedCameraReason = NonNullable<WrappedCameraStatus["reason"]>;
export type WrappedUploadResult = components["schemas"]["WrappedPhotoUploaded"];

const WrappedQueryKeys = {
    camera: ["wrapped", "camera"] as const,
} as const;

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
});
