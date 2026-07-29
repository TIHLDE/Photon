import {
    mutationOptions,
    queryOptions,
    useMutation,
} from "@tanstack/react-query";
import { HTTPError } from "ky";
import { apiClient } from "#/api/api-client";
import { assetPublicUrl } from "#/lib/assets";

const AssetQueryKeys = {
    detail: ["assets", "detail"] as const,
    metadata: ["assets", "metadata"] as const,
} as const;

export const getAssetQuery = (key: string) =>
    queryOptions({
        queryKey: [...AssetQueryKeys.detail, key],
        queryFn: () =>
            apiClient.get("/api/assets/{key}", {
                params: { key },
            }),
    });

export const getAssetMetadataQuery = (key: string) =>
    queryOptions({
        queryKey: [...AssetQueryKeys.metadata, key],
        queryFn: () =>
            apiClient.get("/api/assets/metadata/{key}", {
                params: { key },
            }),
    });

/**
 * Uploads pass a reverse proxy that rejects large bodies before they reach the
 * API. That rejection carries no CORS headers, so the browser hides the 413 and
 * surfaces a bare `TypeError` instead — the size has to come from the file we
 * tried to send rather than from the response.
 */
function uploadErrorMessage(error: unknown, formData: FormData): string {
    const file = formData.get("file");
    const name = file instanceof File ? `«${file.name}»` : "Filen";
    const size =
        file instanceof File
            ? ` (${(file.size / 1024 / 1024).toFixed(1)} MB)`
            : "";

    if (error instanceof HTTPError && error.response.status === 413) {
        return `${name}${size} er for stor til å lastes opp. Prøv en mindre fil.`;
    }

    if (error instanceof TypeError) {
        return `Fikk ikke lastet opp ${name}${size}. Filen er trolig for stor, eller nettverket ustabilt. Prøv en mindre fil.`;
    }

    return error instanceof Error ? error.message : String(error);
}

export const uploadAssetMutation = mutationOptions({
    mutationFn: async ({ formData }: { formData: FormData }) => {
        try {
            return await apiClient.post("/api/assets", {
                body: formData,
            } as never);
        } catch (error) {
            throw new Error(uploadErrorMessage(error, formData), {
                cause: error,
            });
        }
    },
});

/**
 * Upload a single image and get back the URL to store on the resource.
 *
 * The API re-encodes images to WebP on the way in, so the returned key does not
 * necessarily match the file's original extension — always use the key from the
 * response rather than deriving one from the file name.
 */
export function useImageUploader() {
    const uploadAsset = useMutation(uploadAssetMutation);

    async function uploadImage(file: File): Promise<string> {
        const formData = new FormData();
        formData.append("file", file);
        const asset = await uploadAsset.mutateAsync({ formData });
        return assetPublicUrl(asset.key);
    }

    return { uploadImage, isUploading: uploadAsset.isPending };
}
