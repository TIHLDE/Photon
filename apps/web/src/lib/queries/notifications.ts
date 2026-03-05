import { queryOptions } from "@tanstack/react-query";
import { photon } from "~/lib/api";

export const notificationKeys = {
    all: ["notifications"] as const,
    lists: () => [...notificationKeys.all, "list"] as const,
    list: (filters: Record<string, unknown>) =>
        [...notificationKeys.lists(), filters] as const,
};

export const listNotificationsQuery = (
    filters: { pageSize?: number; page?: number } = {},
) =>
    queryOptions({
        queryKey: notificationKeys.list(filters),
        queryFn: () =>
            photon
                .GET("/api/notification", { params: { query: filters } })
                .then((r) => r.data),
    });
