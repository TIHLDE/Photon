import {
    type QueryClient,
    infiniteQueryOptions,
    mutationOptions,
    queryOptions,
} from "@tanstack/react-query";
import { apiClient } from "#/api/api-client";
import type { QueryParamsHelper } from "@tihlde/sdk/types";
import type {
    CreateEventSchema,
    UpdateEventSchema,
    CreatePaymentBody,
    CreateEventForm,
    CreateStrike,
    UpdateFavoriteEvent,
} from "@tihlde/sdk";

const EventQueryKeys = {
    listInfinite: ["events", "list-infinite"] as const,
    list: ["events", "list-paged"] as const,
    detail: ["events", "detail"] as const,
    favorites: ["events", "favorites"] as const,
    registrations: ["events", "registrations"] as const,
    payments: ["events", "payments"] as const,
    forms: ["events", "forms"] as const,
    strikes: ["events", "strikes"] as const,
    myHistory: ["events", "my-history"] as const,
    myHistoryInfinite: ["events", "my-history-infinite"] as const,
} as const;

const DEFAULT_PAGE_SIZE = 25;

type EventListFilters = Omit<
    QueryParamsHelper<"get", "/api/event">,
    "page" | "pageSize"
>;

export const getEventsQuery = (
    page: number,
    filters: EventListFilters = {},
    pageSize: number = DEFAULT_PAGE_SIZE,
) =>
    queryOptions({
        queryKey: [...EventQueryKeys.list, page, pageSize, filters],
        queryFn: () =>
            apiClient.get("/api/event", {
                searchParams: {
                    page,
                    pageSize,
                    ...filters,
                },
            }),
    });

export const getEventsInfiniteQuery = (
    filters: EventListFilters = {},
    pageSize: number = DEFAULT_PAGE_SIZE,
) =>
    infiniteQueryOptions({
        queryKey: [...EventQueryKeys.listInfinite, pageSize, filters],
        queryFn: ({ pageParam }) =>
            apiClient.get("/api/event", {
                searchParams: {
                    page: pageParam,
                    pageSize,
                    ...filters,
                },
            }),
        initialPageParam: 0,
        getNextPageParam: (lastPage) => lastPage.nextPage,
    });

export const getEventByIdQuery = (eventId: string) =>
    queryOptions({
        queryKey: [...EventQueryKeys.detail, eventId],
        queryFn: () =>
            apiClient.get(`/api/event/{eventId}`, {
                params: { eventId },
            }),
    });

/**
 * Frisk opp arrangementsdetaljene, uansett om de ligger i cachen under slug
 * eller ID.
 *
 * Endepunktet tar imot begge, og de offentlige sidene slår opp på slug mens
 * mutasjonene bare kjenner ID-en. Å invalidere på ID alene bommet derfor på
 * nøkkelen siden faktisk brukte: påmeldingskortet ble stående uendret til
 * brukeren lastet siden på nytt.
 */
function invalidateEventDetails(client: QueryClient): Promise<void> {
    return client.invalidateQueries({
        queryKey: [...EventQueryKeys.detail],
        exact: false,
    });
}

export const updateEventMutation = mutationOptions({
    mutationFn: ({
        eventId,
        data,
    }: {
        eventId: string;
        data: UpdateEventSchema;
    }) =>
        apiClient.put("/api/event/{id}", {
            params: { id: eventId },
            json: data,
        }),
    onSuccess(_, __, ___, ctx) {
        // En tittelendring gir dessuten ny slug, så hele detail-nøkkelen må
        // friskes opp.
        invalidateEventDetails(ctx.client);
        ctx.client.invalidateQueries({
            queryKey: [...EventQueryKeys.list],
            exact: false,
        });
        ctx.client.invalidateQueries({
            queryKey: [...EventQueryKeys.listInfinite],
            exact: false,
        });
    },
});

export const deleteEventMutation = mutationOptions({
    mutationFn: ({ eventId }: { eventId: string }) =>
        apiClient.delete(`/api/event/{eventId}`, {
            params: { eventId: eventId },
        }),
    onSuccess(_, __, ___, ctx) {
        invalidateEventDetails(ctx.client);
        ctx.client.invalidateQueries({
            queryKey: [...EventQueryKeys.list],
            exact: false,
        });
        ctx.client.invalidateQueries({
            queryKey: [...EventQueryKeys.listInfinite],
            exact: false,
        });
    },
});

export const createEventMutation = mutationOptions({
    mutationFn: ({ data }: { data: CreateEventSchema }) =>
        apiClient.post("/api/event", {
            json: data,
        }),
    onSuccess(_, __, ___, ctx) {
        ctx.client.invalidateQueries({
            queryKey: [...EventQueryKeys.list],
            exact: false,
        });
        ctx.client.invalidateQueries({
            queryKey: [...EventQueryKeys.listInfinite],
            exact: false,
        });
    },
});

// -- Favorites --

export const getFavoriteEventsQuery = () =>
    queryOptions({
        queryKey: [...EventQueryKeys.favorites],
        queryFn: () => apiClient.get("/api/event/favorite"),
    });

/**
 * Arrangementene du faktisk har vært på — brukes i «Tidligere» på profilen.
 * Avlyste og ubetalte påmeldinger og alt som ikke er over ennå er filtrert
 * bort server-side.
 */
export const getMyEventHistoryQuery = (
    page: number,
    pageSize: number = DEFAULT_PAGE_SIZE,
) =>
    queryOptions({
        queryKey: [...EventQueryKeys.myHistory, page, pageSize] as const,
        queryFn: () =>
            apiClient.get("/api/event/my-registrations", {
                searchParams: { page, pageSize },
            }),
    });

/**
 * Samme liste som `getMyEventHistoryQuery`, men side for side — profilen viste
 * bare de 25 nyeste og hadde ingen vei til resten.
 */
export const getMyEventHistoryInfiniteQuery = (
    pageSize: number = DEFAULT_PAGE_SIZE,
) =>
    infiniteQueryOptions({
        queryKey: [...EventQueryKeys.myHistoryInfinite, pageSize] as const,
        queryFn: ({ pageParam }) =>
            apiClient.get("/api/event/my-registrations", {
                searchParams: { page: pageParam, pageSize },
            }),
        initialPageParam: 0,
        getNextPageParam: (lastPage) => lastPage.nextPage,
    });

export const updateFavoriteEventMutation = mutationOptions({
    mutationFn: ({
        eventId,
        data,
    }: {
        eventId: string;
        data: UpdateFavoriteEvent;
    }) =>
        apiClient.put("/api/event/favorite/{id}", {
            params: { id: eventId },
            json: data,
        }),
    onSuccess(_, __, ___, ctx) {
        ctx.client.invalidateQueries({
            queryKey: [...EventQueryKeys.favorites],
            exact: false,
        });
    },
});

// -- Registrations (Participants) --

type RegistrationListFilters = Omit<
    QueryParamsHelper<"get", "/api/event/{eventId}/registration">,
    "page" | "pageSize"
>;

export const getEventRegistrationsQuery = (
    eventId: string,
    page: number,
    filters: RegistrationListFilters = {},
    pageSize: number = DEFAULT_PAGE_SIZE,
) =>
    queryOptions({
        queryKey: [
            ...EventQueryKeys.registrations,
            eventId,
            page,
            pageSize,
            filters,
        ],
        queryFn: () =>
            apiClient.get("/api/event/{eventId}/registration", {
                params: { eventId },
                searchParams: {
                    page,
                    pageSize,
                    ...filters,
                },
            }),
    });

export const registerForEventMutation = mutationOptions({
    mutationFn: ({
        eventId,
        allowPhoto = true,
    }: {
        eventId: string;
        allowPhoto?: boolean;
    }) =>
        apiClient.post("/api/event/{eventId}/registration", {
            params: { eventId },
            json: { allowPhoto },
        }),
    onSuccess(_, vars, __, ctx) {
        ctx.client.invalidateQueries({
            queryKey: [...EventQueryKeys.registrations, vars.eventId],
            exact: false,
        });
        invalidateEventDetails(ctx.client);
    },
});

export const unregisterFromEventMutation = mutationOptions({
    mutationFn: ({ eventId }: { eventId: string }) =>
        apiClient.delete("/api/event/{eventId}/registration", {
            params: { eventId },
        }),
    onSuccess(_, vars, __, ctx) {
        ctx.client.invalidateQueries({
            queryKey: [...EventQueryKeys.registrations, vars.eventId],
            exact: false,
        });
        invalidateEventDetails(ctx.client);
    },
});

export const setAttendanceMutation = mutationOptions({
    mutationFn: ({
        eventId,
        userId,
        attended,
    }: {
        eventId: string;
        userId: string;
        attended: boolean;
    }) =>
        apiClient.patch(
            "/api/event/{eventId}/registration/{userId}/attendance",
            {
                params: { eventId, userId },
                json: { attended },
            },
        ),
    onSuccess(_, vars, __, ctx) {
        ctx.client.invalidateQueries({
            queryKey: [...EventQueryKeys.registrations, vars.eventId],
            exact: false,
        });
    },
});

// -- Payment --

export const createEventPaymentMutation = mutationOptions({
    mutationFn: ({
        eventId,
        data,
    }: {
        eventId: string;
        data: CreatePaymentBody;
    }) =>
        apiClient.post("/api/event/{eventId}/payment", {
            params: { eventId },
            json: data,
        }),
});

type PaymentListFilters = Omit<
    QueryParamsHelper<"get", "/api/event/{eventId}/payments">,
    "page" | "pageSize"
>;

export const getEventPaymentsQuery = (
    eventId: string,
    page: number,
    filters: PaymentListFilters = {},
    pageSize: number = DEFAULT_PAGE_SIZE,
) =>
    queryOptions({
        queryKey: [
            ...EventQueryKeys.payments,
            eventId,
            page,
            pageSize,
            filters,
        ],
        queryFn: () =>
            apiClient.get("/api/event/{eventId}/payments", {
                params: { eventId },
                searchParams: { page, pageSize, ...filters },
            }),
    });

export const refundEventPaymentMutation = mutationOptions({
    mutationFn: ({
        eventId,
        paymentId,
    }: {
        eventId: string;
        paymentId: string;
    }) =>
        apiClient.post("/api/event/{eventId}/payments/{paymentId}/refund", {
            params: { eventId, paymentId },
        }),
    onSuccess(_, vars, __, ctx) {
        ctx.client.invalidateQueries({
            queryKey: [...EventQueryKeys.payments, vars.eventId],
            exact: false,
        });
        // The registration list carries a payment status per registrant.
        ctx.client.invalidateQueries({
            queryKey: [...EventQueryKeys.registrations, vars.eventId],
            exact: false,
        });
    },
});

// -- Event Forms --

export const getEventFormsQuery = (eventId: string) =>
    queryOptions({
        queryKey: [...EventQueryKeys.forms, eventId],
        queryFn: () =>
            apiClient.get("/api/event/{eventId}/forms", {
                params: { eventId },
            }),
    });

export const getEventFormByTypeQuery = (
    eventId: string,
    type: "survey" | "evaluation",
) =>
    queryOptions({
        queryKey: [...EventQueryKeys.forms, eventId, type],
        queryFn: () =>
            apiClient.get("/api/event/{eventId}/forms/{type}", {
                params: { eventId, type },
            }),
    });

export const createEventFormMutation = mutationOptions({
    mutationFn: ({
        eventId,
        data,
    }: {
        eventId: string;
        data: CreateEventForm;
    }) =>
        apiClient.post("/api/event/{eventId}/forms", {
            params: { eventId },
            json: data,
        }),
    onSuccess(_, vars, __, ctx) {
        ctx.client.invalidateQueries({
            queryKey: [...EventQueryKeys.forms, vars.eventId],
            exact: false,
        });
    },
});

// -- Strikes (prikker) --

export const getStrikesQuery = (
    page: number,
    userId?: string,
    pageSize: number = DEFAULT_PAGE_SIZE,
) =>
    queryOptions({
        queryKey: [
            ...EventQueryKeys.strikes,
            page,
            pageSize,
            userId ?? null,
        ] as const,
        queryFn: () =>
            apiClient.get("/api/event/strikes", {
                searchParams: {
                    page,
                    pageSize,
                    ...(userId ? { userId } : {}),
                },
            }),
    });

export const createStrikeMutation = mutationOptions({
    mutationFn: ({ data }: { data: CreateStrike }) =>
        apiClient.post("/api/event/strikes", { json: data }),
    onSuccess(_, __, ___, ctx) {
        ctx.client.invalidateQueries({
            queryKey: EventQueryKeys.strikes,
            exact: false,
        });
    },
});

export const deleteStrikeMutation = mutationOptions({
    mutationFn: ({ strikeId }: { strikeId: string }) =>
        apiClient.delete("/api/event/strikes/{strikeId}", {
            params: { strikeId },
        }),
    onSuccess(_, __, ___, ctx) {
        ctx.client.invalidateQueries({
            queryKey: EventQueryKeys.strikes,
            exact: false,
        });
    },
});
