import { mutationOptions, queryOptions } from "@tanstack/react-query";
import { apiClient } from "#/api/api-client";
import type { CreateBanner, UpdateBanner } from "@tihlde/sdk";

const BannerQueryKeys = {
    list: ["banners", "list"] as const,
    visible: ["banners", "visible"] as const,
} as const;

/**
 * Every banner regardless of visibility window — for the admin panel.
 * There are only ever a handful, so the list is unpaginated.
 */
export const getBannersQuery = () =>
    queryOptions({
        queryKey: BannerQueryKeys.list,
        queryFn: () => apiClient.get("/api/banners"),
    });

/** Banners currently live — what the front page renders. */
export const getVisibleBannersQuery = () =>
    queryOptions({
        queryKey: BannerQueryKeys.visible,
        queryFn: () => apiClient.get("/api/banners/visible"),
    });

export const createBannerMutation = mutationOptions({
    mutationFn: ({ data }: { data: CreateBanner }) =>
        apiClient.post("/api/banners", {
            json: data,
        }),
    onSuccess(_, __, ___, ctx) {
        ctx.client.invalidateQueries({ queryKey: ["banners"], exact: false });
    },
});

export const updateBannerMutation = mutationOptions({
    mutationFn: ({
        bannerId,
        data,
    }: {
        bannerId: string;
        data: UpdateBanner;
    }) =>
        apiClient.patch("/api/banners/{id}", {
            params: { id: bannerId },
            json: data,
        }),
    onSuccess(_, __, ___, ctx) {
        ctx.client.invalidateQueries({ queryKey: ["banners"], exact: false });
    },
});

export const deleteBannerMutation = mutationOptions({
    mutationFn: ({ bannerId }: { bannerId: string }) =>
        apiClient.delete("/api/banners/{id}", {
            params: { id: bannerId },
        }),
    onSuccess(_, __, ___, ctx) {
        ctx.client.invalidateQueries({ queryKey: ["banners"], exact: false });
    },
});
