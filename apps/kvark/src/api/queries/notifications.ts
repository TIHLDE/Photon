import {
    infiniteQueryOptions,
    mutationOptions,
    queryOptions,
} from "@tanstack/react-query";
import { apiClient } from "#/api/api-client";
import type { QueryParamsHelper } from "@tihlde/sdk/types";

const NotificationQueryKeys = {
    listInfinite: ["notifications", "list-infinite"] as const,
    list: ["notifications", "list-paged"] as const,
    unreadCount: ["notifications", "unread-count"] as const,
} as const;

const DEFAULT_PAGE_SIZE = 25;

type NotificationListFilters = Omit<
    QueryParamsHelper<"get", "/api/notification">,
    "page" | "pageSize"
>;

export const getNotificationsQuery = (
    page: number,
    filters: NotificationListFilters = {},
    pageSize: number = DEFAULT_PAGE_SIZE,
) =>
    queryOptions({
        queryKey: [...NotificationQueryKeys.list, page, pageSize, filters],
        queryFn: () =>
            apiClient.get("/api/notification", {
                searchParams: {
                    page,
                    pageSize,
                    ...filters,
                },
            }),
    });

/**
 * Antall uleste varsler. Henter én rad og leser `totalCount` — serveren teller
 * med samme filter, så vi slipper å laste ned varslene for å telle dem.
 */
export const getUnreadNotificationCountQuery = () =>
    queryOptions({
        queryKey: NotificationQueryKeys.unreadCount,
        queryFn: () =>
            apiClient.get("/api/notification", {
                searchParams: { page: 0, pageSize: 1, isRead: false },
            }),
        select: (data) => data.totalCount,
    });

export const getNotificationsInfiniteQuery = (
    filters: NotificationListFilters = {},
    pageSize: number = DEFAULT_PAGE_SIZE,
) =>
    infiniteQueryOptions({
        queryKey: [...NotificationQueryKeys.listInfinite, pageSize, filters],
        queryFn: ({ pageParam }) =>
            apiClient.get("/api/notification", {
                searchParams: {
                    page: pageParam,
                    pageSize,
                    ...filters,
                },
            }),
        initialPageParam: 0,
        getNextPageParam: (lastPage) => lastPage.nextPage,
    });

export const deleteNotificationMutation = mutationOptions({
    mutationFn: ({ notificationId }: { notificationId: string }) =>
        apiClient.delete("/api/notification/{id}", {
            params: { id: notificationId },
        }),
    onSuccess(_, __, ___, ctx) {
        ctx.client.invalidateQueries({
            queryKey: [...NotificationQueryKeys.list],
            exact: false,
        });
        ctx.client.invalidateQueries({
            queryKey: [...NotificationQueryKeys.listInfinite],
            exact: false,
        });
        // Både lesing og sletting endrer antallet uleste.
        ctx.client.invalidateQueries({
            queryKey: NotificationQueryKeys.unreadCount,
        });
    },
});

export const markNotificationReadMutation = mutationOptions({
    mutationFn: ({
        notificationId,
        isRead = true,
    }: {
        notificationId: string;
        isRead?: boolean;
    }) =>
        apiClient.patch("/api/notification/{id}/read", {
            params: { id: notificationId },
            json: { isRead },
        }),
    onSuccess(_, __, ___, ctx) {
        ctx.client.invalidateQueries({
            queryKey: [...NotificationQueryKeys.list],
            exact: false,
        });
        ctx.client.invalidateQueries({
            queryKey: [...NotificationQueryKeys.listInfinite],
            exact: false,
        });
        // Både lesing og sletting endrer antallet uleste.
        ctx.client.invalidateQueries({
            queryKey: NotificationQueryKeys.unreadCount,
        });
    },
});
