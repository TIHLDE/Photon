import { infiniteQueryOptions, mutationOptions, queryOptions } from "@tanstack/react-query";

import { photonClient } from "../apiClient";
import { QueryParamsHelper } from "@tihlde/sdk/types";
import type { CreateEventForm, CreateEventSchema, CreatePaymentBody, EventRegistration, UpdateEventSchema, UpdateFavoriteEvent } from "@tihlde/sdk";

export type {
  CreateEventResponse,
  CreateEventForm,
  CreatePaymentBody,
  Event,
  EventFormDetail,
  EventFormList,
  EventList,
  EventListItem,
  EventRegisteredUser,
  EventRegistrationList,
  EventRegistration,
  CreateEventFormResponse,
  DeleteEventResponse,
  FavoriteEvents,
  CreateEventSchema,
  UpdateEventSchema,
  UpdateFavoriteEvent,
} from "@tihlde/sdk";

export type { EventListItem as EventListEntry } from "@tihlde/sdk";

export type EventFilters = QueryParamsHelper<"get", "/api/event">;
export type EventRegistrationFilters = QueryParamsHelper<"get", "/api/event/{eventId}/registration">;

export const eventKeys = {
  all: ["events"],
  infinite: ["events", "infinite"],
  lists: ["events", "list"],
  details: ["events", "detail"],
  favorites: ["events", "favorites"],
  registrations: ["events", "registrations"],
  forms: ["events", "forms"],
} as const;

const DEFAULT_PAGE_SIZE = 20;

export const listEventInfiniteQuery = (filters: EventFilters = {}) =>
  infiniteQueryOptions({
    queryKey: [...eventKeys.infinite, filters],
    queryFn: async ({ pageParam }) =>
      await photonClient
        .get("/api/event", {
          queryParams: {
            ...filters,
            page: pageParam,
            pageSize: DEFAULT_PAGE_SIZE,
          },
        })
        .then((r) => r.unwrap().data),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextPage,
  });

export const listEventsQuery = (page: number, pageSize = DEFAULT_PAGE_SIZE, filters: Omit<EventFilters, "page" | "pageSize"> = {}) =>
  queryOptions({
    queryKey: [...eventKeys.lists, filters, page, pageSize],
    queryFn: () =>
      photonClient
        .get("/api/event", {
          queryParams: {
            ...filters,
            page,
            pageSize,
          },
        })
        .then((r) => r.unwrap().data),
    select: (data) => data.items,
  });

export const getEventQuery = (eventId: string) =>
  queryOptions({
    queryKey: [...eventKeys.details, eventId],
    queryFn: () =>
      photonClient
        .get("/api/event/{eventId}", {
          pathParams: { eventId },
        })
        .then((r) => r.unwrap().data),
  });

export const getFavoriteEventsQuery = () =>
  queryOptions({
    queryKey: [...eventKeys.favorites],
    queryFn: () => photonClient.get("/api/event/favorite").then((r) => r.unwrap().data),
  });

export const listEventRegistrationsQuery = (eventId: string, filters: EventRegistrationFilters = {}) =>
  queryOptions({
    queryKey: [...eventKeys.registrations, eventId, filters],
    queryFn: () =>
      photonClient
        .get("/api/event/{eventId}/registration", {
          pathParams: { eventId },
          queryParams: filters ?? {},
        })
        .then((r) => r.unwrap().data),
  });

export const listEventFormsQuery = (eventId: string) =>
  queryOptions({
    queryKey: [...eventKeys.forms, eventId],
    queryFn: () =>
      photonClient
        .get("/api/event/{eventId}/forms", {
          pathParams: { eventId },
        })
        .then((r) => r.unwrap().data),
  });

export const getEventFormQuery = (eventId: string, type: "survey" | "evaluation") =>
  queryOptions({
    queryKey: [...eventKeys.forms, eventId, type],
    queryFn: () =>
      photonClient
        .get("/api/event/{eventId}/forms/{type}", {
          pathParams: { eventId, type },
        })
        .then((r) => r.unwrap().data),
  });

export const createEventMutation = mutationOptions({
  mutationFn: (body: CreateEventSchema) => photonClient.post("/api/event", body).then((r) => r.unwrap().data),
  onMutate: async (_, ctx) => {
    await ctx.client.cancelQueries({ queryKey: eventKeys.lists });
  },
  onSuccess: (_, __, ___, ctx) => {
    ctx.client.invalidateQueries({ queryKey: eventKeys.lists });
  },
});

export const updateEventMutation = (id: string) =>
  mutationOptions({
    mutationFn: (body: UpdateEventSchema) =>
      photonClient
        .put("/api/event/{id}", body, {
          pathParams: { id },
        })
        .then((r) => r.unwrap().data),
    onMutate: async (_, ctx) => {
      await ctx.client.cancelQueries({ queryKey: eventKeys.all });
    },
    onSuccess: (_, __, ___, ctx) => {
      ctx.client.invalidateQueries({ queryKey: eventKeys.all });
    },
  });

export const deleteEventMutation = (eventId: string) =>
  mutationOptions({
    mutationFn: () =>
      photonClient
        .del("/api/event/{eventId}", {
          pathParams: { eventId },
        })
        .then((r) => r.unwrap().data),
    onSuccess: (_, __, ___, ctx) => {
      ctx.client.invalidateQueries({ queryKey: eventKeys.all });
    },
  });

export const updateEventFavoriteMutation = (id: string) =>
  mutationOptions({
    mutationFn: (body: UpdateFavoriteEvent) =>
      photonClient
        .put("/api/event/favorite/{id}", body, {
          pathParams: { id },
        })
        .then((r) => r.unwrap().data),
    onMutate: async (_, ctx) => {
      await ctx.client.cancelQueries({ queryKey: eventKeys.favorites });
    },
    onSuccess: (_, __, ___, ctx) => {
      ctx.client.invalidateQueries({ queryKey: eventKeys.favorites });
    },
  });

export const createEventRegistrationMutation = (eventId: string) =>
  mutationOptions({
    mutationFn: (body: EventRegistration) =>
      photonClient
        .post("/api/event/{eventId}/registration", body, {
          pathParams: { eventId },
        })
        .then((r) => r.unwrap().data),
    onMutate: async (_, ctx) => {
      await ctx.client.cancelQueries({ queryKey: eventKeys.registrations });
    },
    onSuccess: (_, __, ___, ctx) => {
      ctx.client.invalidateQueries({ queryKey: eventKeys.registrations });
    },
  });

export const deleteEventRegistrationMutation = (eventId: string) =>
  mutationOptions({
    mutationFn: () =>
      photonClient
        .del("/api/event/{eventId}/registration", {
          pathParams: { eventId },
        })
        .then((r) => r.unwrap().data),
    onSuccess: (_, __, ___, ctx) => {
      ctx.client.invalidateQueries({ queryKey: eventKeys.registrations });
    },
  });

export const createEventPaymentMutation = (eventId: string) =>
  mutationOptions({
    mutationFn: (body: CreatePaymentBody) =>
      photonClient
        .post("/api/event/{eventId}/payment", body, {
          pathParams: { eventId },
        })
        .then((r) => r.unwrap().data),
    onSuccess: (_, __, ___, ctx) => {
      ctx.client.invalidateQueries({ queryKey: eventKeys.registrations });
    },
  });

export const createEventFormMutation = (eventId: string) =>
  mutationOptions({
    mutationFn: (body: CreateEventForm) =>
      photonClient
        .post("/api/event/{eventId}/forms", body, {
          pathParams: { eventId },
        })
        .then((r) => r.unwrap().data),
    onMutate: async (_, ctx) => {
      await ctx.client.cancelQueries({ queryKey: eventKeys.forms });
    },
    onSuccess: (_, __, ___, ctx) => {
      ctx.client.invalidateQueries({ queryKey: eventKeys.forms });
    },
  });
