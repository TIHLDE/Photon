import { mutationOptions, queryOptions } from "@tanstack/react-query";
import type { CreateToddel, UpdateToddel } from "@photon/codegen";
import { apiClient } from "#/api/api-client";

const ToddelQueryKeys = {
    list: ["toddel", "list"] as const,
} as const;

/**
 * The whole archive in one call — it is a couple of dozen issues that gain one
 * entry a semester, so paging it would cost more than it saves.
 */
export const getToddelIssuesQuery = () =>
    queryOptions({
        queryKey: ToddelQueryKeys.list,
        queryFn: () => apiClient.get("/api/toddel"),
    });

export const createToddelMutation = mutationOptions({
    mutationFn: ({ data }: { data: CreateToddel }) =>
        apiClient.post("/api/toddel", { body: data }),
    onSuccess(_, __, ___, ctx) {
        ctx.client.invalidateQueries(getToddelIssuesQuery());
    },
});

export const updateToddelMutation = mutationOptions({
    mutationFn: ({ edition, data }: { edition: number; data: UpdateToddel }) =>
        apiClient.patch("/api/toddel/{edition}", {
            path: { edition: String(edition) },
            body: data,
        }),
    onSuccess(_, __, ___, ctx) {
        ctx.client.invalidateQueries(getToddelIssuesQuery());
    },
});

export const deleteToddelMutation = mutationOptions({
    mutationFn: ({ edition }: { edition: number }) =>
        apiClient.delete("/api/toddel/{edition}", {
            path: { edition: String(edition) },
        }),
    onSuccess(_, __, ___, ctx) {
        ctx.client.invalidateQueries(getToddelIssuesQuery());
    },
});
