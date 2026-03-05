import { queryOptions } from "@tanstack/react-query";
import { photon } from "~/lib/api";

export const newsKeys = {
    all: ["news"] as const,
    lists: () => [...newsKeys.all, "list"] as const,
    list: (filters: Record<string, unknown>) =>
        [...newsKeys.lists(), filters] as const,
    details: () => [...newsKeys.all, "detail"] as const,
    detail: (id: string) => [...newsKeys.details(), id] as const,
};

export const listNewsQuery = (
    filters: { pageSize?: number; page?: number } = {},
) =>
    queryOptions({
        queryKey: newsKeys.list(filters),
        queryFn: () =>
            photon
                .GET("/api/news", { params: { query: filters } })
                .then((r) => r.data),
    });

export const getNewsQuery = (id: string) =>
    queryOptions({
        queryKey: newsKeys.detail(id),
        queryFn: () =>
            photon
                .GET("/api/news/{id}", { params: { path: { id } } })
                .then((r) => r.data),
    });
