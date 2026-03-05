import { queryOptions } from "@tanstack/react-query";
import { photon } from "~/lib/api";

export const eventKeys = {
    all: ["events"] as const,
    lists: () => [...eventKeys.all, "list"] as const,
    list: (filters: Record<string, unknown>) =>
        [...eventKeys.lists(), filters] as const,
    details: () => [...eventKeys.all, "detail"] as const,
    detail: (id: string) => [...eventKeys.details(), id] as const,
    registrations: (eventId: string) =>
        [...eventKeys.detail(eventId), "registrations"] as const,
    favorites: () => [...eventKeys.all, "favorites"] as const,
};

export const listEventsQuery = (
    filters: {
        pageSize?: number;
        page?: number;
        search?: string;
        expired?: boolean;
        openSignUp?: boolean;
    } = {},
) =>
    queryOptions({
        queryKey: eventKeys.list(filters),
        queryFn: () =>
            photon
                .GET("/api/event", { params: { query: filters } })
                .then((r) => r.data),
    });

export const getEventQuery = (eventId: string) =>
    queryOptions({
        queryKey: eventKeys.detail(eventId),
        queryFn: () =>
            photon
                .GET("/api/event/{eventId}", {
                    params: { path: { eventId } },
                })
                .then((r) => r.data),
    });

export const listEventRegistrationsQuery = (eventId: string) =>
    queryOptions({
        queryKey: eventKeys.registrations(eventId),
        queryFn: () =>
            photon
                .GET("/api/event/{eventId}/registration", {
                    params: { path: { eventId } },
                })
                .then((r) => r.data),
    });

export const getFavoriteEventsQuery = () =>
    queryOptions({
        queryKey: eventKeys.favorites(),
        queryFn: () => photon.GET("/api/event/favorite").then((r) => r.data),
    });
