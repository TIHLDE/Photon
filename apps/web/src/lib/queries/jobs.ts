import { queryOptions } from "@tanstack/react-query";
import { photon } from "~/lib/api";

export const jobKeys = {
    all: ["jobs"] as const,
    lists: () => [...jobKeys.all, "list"] as const,
    list: (filters: Record<string, unknown>) =>
        [...jobKeys.lists(), filters] as const,
    details: () => [...jobKeys.all, "detail"] as const,
    detail: (id: string) => [...jobKeys.details(), id] as const,
};

export const listJobsQuery = (
    filters: {
        pageSize?: number;
        page?: number;
        search?: string;
        expired?: boolean;
        jobType?: "full_time" | "part_time" | "summer_job" | "other";
        year?: "first" | "second" | "third" | "fourth" | "fifth" | "alumni";
    } = {},
) =>
    queryOptions({
        queryKey: jobKeys.list(filters),
        queryFn: () =>
            photon
                .GET("/api/jobs", { params: { query: filters } })
                .then((r) => r.data),
    });

export const getJobQuery = (id: string) =>
    queryOptions({
        queryKey: jobKeys.detail(id),
        queryFn: () =>
            photon
                .GET("/api/jobs/{id}", { params: { path: { id } } })
                .then((r) => r.data),
    });
