import { mutationOptions, queryOptions } from "@tanstack/react-query";
import { uploadErrorMessage } from "#/api/queries/assets";
import { mockGetCamera, mockUpload } from "#/api/queries/wrapped-mock";

/**
 * Engangskameraet (tihlde-wrapped). Formen følger kontrakten i #865.
 *
 * TODO(#867): API-et er ikke slått sammen ennå, så status og opplasting er
 * statiske stand-ins fra `wrapped-mock.ts`, delt med utvalget i
 * `wrapped-admin.ts`. Når `@tihlde/sdk` har rutene, byttes `queryFn` og
 * `mutationFn` til `apiClient` og `wrapped-mock.ts` slettes.
 */

export type WrappedCameraReason =
    | "disabled"
    | "not_open_yet"
    | "closed"
    | "not_registered"
    | "no_shots_left";

export type WrappedCameraStatus = {
    enabled: boolean;
    shotsPerPerson: number;
    opensAt: string;
    closesAt: string;
    isOpen: boolean;
    shotsUsed: number;
    shotsLeft: number;
    canShoot: boolean;
    reason: WrappedCameraReason | null;
    canManage: boolean;
};

export type WrappedUploadResult = {
    id: string;
    shotsUsed: number;
    shotsLeft: number;
};

const WrappedQueryKeys = {
    camera: ["wrapped", "camera"] as const,
} as const;

export const getWrappedCameraQuery = (eventId: string) =>
    queryOptions({
        queryKey: [...WrappedQueryKeys.camera, eventId],
        queryFn: () => mockGetCamera(),
    });

export const uploadWrappedPhotoMutation = mutationOptions({
    mutationFn: async ({
        file,
    }: {
        eventId: string;
        file: File;
    }): Promise<WrappedUploadResult> => {
        const formData = new FormData();
        formData.append("file", file);
        try {
            return await mockUpload(file);
        } catch (error) {
            // `cause` beholder den opprinnelige feilen, så ruta kan lese
            // statuskoden (403/409 betyr at statusen er utdatert).
            throw new Error(uploadErrorMessage(error, formData), {
                cause: error,
            });
        }
    },
});
