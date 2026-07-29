import {
    mutationOptions,
    queryOptions,
    useMutation,
} from "@tanstack/react-query";
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

export const uploadAssetMutation = mutationOptions({
    mutationFn: ({ formData }: { formData: FormData }) =>
        apiClient.post("/api/assets", {
            body: formData,
        } as never),
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
