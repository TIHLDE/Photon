import { queryOptions } from "@tanstack/react-query";
import { apiClient } from "#/api/api-client";

const InstituteQueryKeys = {
    list: ["institutes", "list"] as const,
} as const;

/**
 * The NTNU institutes TIHLDE's study programmes run under. Reference data —
 * there are only ever a couple of rows, and they change about never.
 */
export const getInstitutesQuery = () =>
    queryOptions({
        queryKey: [...InstituteQueryKeys.list],
        queryFn: () => apiClient.get("/api/institutes"),
    });
