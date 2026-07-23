import { mutationOptions, queryOptions } from "@tanstack/react-query";
import { apiClient } from "#/api/api-client";
import type { CreateMotetidEvent, SaveMotetidAvailability } from "@tihlde/sdk";

const MotetidQueryKeys = {
    list: ["motetid", "list"] as const,
    detail: (slug: string) => ["motetid", "detail", slug] as const,
} as const;

/** The member's own scheduling events — created or participated in. */
export const getMyMotetidEventsQuery = () =>
    queryOptions({
        queryKey: MotetidQueryKeys.list,
        queryFn: () => apiClient.get("/api/motetid/events"),
    });

/** The full availability board for one event (public via share link). */
export const getMotetidEventQuery = (slug: string) =>
    queryOptions({
        queryKey: MotetidQueryKeys.detail(slug),
        queryFn: () =>
            apiClient.get("/api/motetid/events/{slug}", {
                params: { slug },
            }),
    });

export const createMotetidEventMutation = mutationOptions({
    mutationFn: ({ data }: { data: CreateMotetidEvent }) =>
        apiClient.post("/api/motetid/events", { json: data }),
    onSuccess(_, __, ___, ctx) {
        ctx.client.invalidateQueries({ queryKey: MotetidQueryKeys.list });
    },
});

export const saveMotetidAvailabilityMutation = mutationOptions({
    mutationFn: ({
        slug,
        data,
    }: {
        slug: string;
        data: SaveMotetidAvailability;
    }) =>
        apiClient.put("/api/motetid/events/{slug}/availability", {
            params: { slug },
            json: data,
        }),
    onSuccess(_, { slug }, ___, ctx) {
        ctx.client.invalidateQueries({
            queryKey: MotetidQueryKeys.detail(slug),
        });
        ctx.client.invalidateQueries({ queryKey: MotetidQueryKeys.list });
    },
});

export const deleteMotetidEventMutation = mutationOptions({
    mutationFn: ({ slug }: { slug: string }) =>
        apiClient.delete("/api/motetid/events/{slug}", { params: { slug } }),
    onSuccess(_, __, ___, ctx) {
        ctx.client.invalidateQueries({ queryKey: MotetidQueryKeys.list });
    },
});

/** Ask the API to build a Google OAuth consent URL to navigate to. */
export const motetidGoogleConnectMutation = mutationOptions({
    mutationFn: ({ returnTo }: { returnTo: string }) =>
        apiClient.get("/api/motetid/google/connect", {
            searchParams: { returnTo },
        }),
});

export const motetidSyncCalendarMutation = mutationOptions({
    mutationFn: ({ slug }: { slug: string }) =>
        apiClient.post("/api/motetid/events/{slug}/sync-calendar", {
            params: { slug },
        }),
});
