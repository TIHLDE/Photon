import { queryOptions } from "@tanstack/react-query";
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
