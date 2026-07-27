import {
    infiniteQueryOptions,
    mutationOptions,
    queryOptions,
} from "@tanstack/react-query";
import type {
    CreateGallery,
    CreateGalleryPictures,
    UpdateGallery,
    UpdateGalleryPicture,
} from "@tihlde/sdk";
import { apiClient } from "#/api/api-client";

const GalleryQueryKeys = {
    list: ["galleries", "list-paged"] as const,
    listInfinite: ["galleries", "list-infinite"] as const,
    detail: ["galleries", "detail"] as const,
    pictures: ["galleries", "pictures"] as const,
} as const;

/** Matches Lepton's BasePagination, so paging feels the same as the old site. */
const DEFAULT_PAGE_SIZE = 25;

export const getGalleriesQuery = (
    page: number,
    pageSize: number = DEFAULT_PAGE_SIZE,
) =>
    queryOptions({
        queryKey: [...GalleryQueryKeys.list, page, pageSize],
        queryFn: () =>
            apiClient.get("/api/galleries", {
                searchParams: { page, pageSize },
            }),
    });

export const getGalleriesInfiniteQuery = (
    pageSize: number = DEFAULT_PAGE_SIZE,
) =>
    infiniteQueryOptions({
        queryKey: [...GalleryQueryKeys.listInfinite, pageSize],
        queryFn: ({ pageParam }) =>
            apiClient.get("/api/galleries", {
                searchParams: { page: pageParam, pageSize },
            }),
        initialPageParam: 0,
        getNextPageParam: (lastPage) => lastPage.nextPage,
    });

export const getGalleryQuery = (slug: string) =>
    queryOptions({
        queryKey: [...GalleryQueryKeys.detail, slug],
        queryFn: () =>
            apiClient.get("/api/galleries/{slug}", { params: { slug } }),
    });

/**
 * The pictures inside one album, page by page. This is what the "Last inn mer"
 * button drives.
 */
export const getGalleryPicturesInfiniteQuery = (
    slug: string,
    pageSize: number = DEFAULT_PAGE_SIZE,
) =>
    infiniteQueryOptions({
        queryKey: [...GalleryQueryKeys.pictures, slug, pageSize],
        queryFn: ({ pageParam }) =>
            apiClient.get("/api/galleries/{slug}/pictures", {
                params: { slug },
                searchParams: { page: pageParam, pageSize },
            }),
        initialPageParam: 0,
        getNextPageParam: (lastPage) => lastPage.nextPage,
    });

export const createGalleryMutation = mutationOptions({
    mutationFn: ({ data }: { data: CreateGallery }) =>
        apiClient.post("/api/galleries", { json: data }),
    onSuccess(_, __, ___, ctx) {
        ctx.client.invalidateQueries({
            queryKey: [...GalleryQueryKeys.list],
            exact: false,
        });
        ctx.client.invalidateQueries({
            queryKey: [...GalleryQueryKeys.listInfinite],
            exact: false,
        });
    },
});

export const updateGalleryMutation = mutationOptions({
    mutationFn: ({ slug, data }: { slug: string; data: UpdateGallery }) =>
        apiClient.patch("/api/galleries/{slug}", {
            params: { slug },
            json: data,
        }),
    onSuccess(_, vars, __, ctx) {
        ctx.client.invalidateQueries(getGalleryQuery(vars.slug));
        ctx.client.invalidateQueries({
            queryKey: [...GalleryQueryKeys.list],
            exact: false,
        });
        ctx.client.invalidateQueries({
            queryKey: [...GalleryQueryKeys.listInfinite],
            exact: false,
        });
    },
});

export const deleteGalleryMutation = mutationOptions({
    mutationFn: ({ slug }: { slug: string }) =>
        apiClient.delete("/api/galleries/{slug}", { params: { slug } }),
    onSuccess(_, __, ___, ctx) {
        ctx.client.invalidateQueries({
            queryKey: [...GalleryQueryKeys.list],
            exact: false,
        });
        ctx.client.invalidateQueries({
            queryKey: [...GalleryQueryKeys.listInfinite],
            exact: false,
        });
    },
});

export const createGalleryPicturesMutation = mutationOptions({
    mutationFn: ({
        slug,
        data,
    }: {
        slug: string;
        data: CreateGalleryPictures;
    }) =>
        apiClient.post("/api/galleries/{slug}/pictures", {
            params: { slug },
            json: data,
        }),
    onSuccess(_, vars, __, ctx) {
        ctx.client.invalidateQueries({
            queryKey: [...GalleryQueryKeys.pictures, vars.slug],
            exact: false,
        });
        ctx.client.invalidateQueries(getGalleryQuery(vars.slug));
    },
});

export const updateGalleryPictureMutation = mutationOptions({
    mutationFn: ({
        slug,
        pictureId,
        data,
    }: {
        slug: string;
        pictureId: string;
        data: UpdateGalleryPicture;
    }) =>
        apiClient.patch("/api/galleries/{slug}/pictures/{pictureId}", {
            params: { slug, pictureId },
            json: data,
        }),
    onSuccess(_, vars, __, ctx) {
        ctx.client.invalidateQueries({
            queryKey: [...GalleryQueryKeys.pictures, vars.slug],
            exact: false,
        });
    },
});

export const deleteGalleryPictureMutation = mutationOptions({
    mutationFn: ({ slug, pictureId }: { slug: string; pictureId: string }) =>
        apiClient.delete("/api/galleries/{slug}/pictures/{pictureId}", {
            params: { slug, pictureId },
        }),
    onSuccess(_, vars, __, ctx) {
        ctx.client.invalidateQueries({
            queryKey: [...GalleryQueryKeys.pictures, vars.slug],
            exact: false,
        });
        ctx.client.invalidateQueries(getGalleryQuery(vars.slug));
    },
});
