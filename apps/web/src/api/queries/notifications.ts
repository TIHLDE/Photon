import { mutationOptions, queryOptions } from "@tanstack/react-query";

import { photonClient } from "../apiClient";
import { QueryParamsHelper } from "@tihlde/sdk/types";

export type { Notification, NotificationList, DeleteNotificationResponse, MarkReadResponse } from "@tihlde/sdk";

export type NotificationFilters = QueryParamsHelper<"get", "/api/notification">;

export const notificationKeys = {
  all: ["notifications"],
  lists: ["notifications", "list"],
} as const;

export const listNotificationsQuery = (filters?: NotificationFilters) =>
  queryOptions({
    queryKey: [...notificationKeys.lists, filters].filter(Boolean),
    queryFn: () =>
      photonClient
        .get("/api/notification", {
          queryParams: filters,
        })
        .then((r) => r.unwrap().data),
  });

export const deleteNotificationMutation = (id: string) =>
  mutationOptions({
    mutationFn: () =>
      photonClient
        .del("/api/notification/{id}", {
          pathParams: { id },
        })
        .then((r) => r.unwrap().data),
    onSuccess: (_, __, ___, ctx) => {
      ctx.client.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });

export const markNotificationReadMutation = (id: string) =>
  mutationOptions({
    mutationFn: (body: Parameters<typeof photonClient.patch<"/api/notification/{id}/read">>[1]) =>
      photonClient
        .patch("/api/notification/{id}/read", body, {
          pathParams: { id },
        })
        .then((r) => r.unwrap().data),
    onSuccess: (_, __, ___, ctx) => {
      ctx.client.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
