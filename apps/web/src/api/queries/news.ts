import { infiniteQueryOptions, mutationOptions, queryOptions } from "@tanstack/react-query";

import { photonClient } from "../apiClient";
import { QueryParamsHelper } from "@tihlde/sdk/types";
import type { CreateNews, CreateNewsReaction, UpdateNews } from "@tihlde/sdk";

export type {
  CreateNews,
  CreateNewsReaction,
  UpdateNews,
  NewsArticle,
  NewsList,
  NewsListItem,
  NewsReaction,
  DeleteNewsResponse,
  DeleteNewsReactionResponse,
} from "@tihlde/sdk";

export type { NewsListItem as NewsListEntry } from "@tihlde/sdk";

export const newsKeys = {
  all: ["news"],
  infinite: ["news", "infinite"],
  lists: ["news", "list"],
  details: ["news", "detail"],
} as const;

const DEFAULT_PAGE_SIZE = 20;

export type NewsFilters = QueryParamsHelper<"get", "/api/news">;

export const listNewsQuery = (page: number, pageSize = DEFAULT_PAGE_SIZE, filters: NewsFilters = {}) =>
  queryOptions({
    queryKey: [...newsKeys.lists, filters, page, pageSize],
    queryFn: () =>
      photonClient
        .get("/api/news", {
          queryParams: {
            ...filters,
            page,
            pageSize,
          },
        })
        .then((r) => r.unwrap().data),
  });

export const listNewsInfiniteQuery = (filters?: NewsFilters) =>
  infiniteQueryOptions({
    queryKey: [...newsKeys.infinite, filters].filter(Boolean),
    queryFn: async ({ pageParam }) =>
      await photonClient
        .get("/api/news", {
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

export const getNewsQuery = (id: string) =>
  queryOptions({
    queryKey: [...newsKeys.details, id],
    queryFn: () =>
      photonClient
        .get("/api/news/{id}", {
          pathParams: { id },
        })
        .then((r) => r.unwrap().data),
  });

export const createNewsMutation = mutationOptions({
  mutationFn: (body: CreateNews) => photonClient.post("/api/news", body).then((r) => r.unwrap().data),
  onMutate: async (_, ctx) => {
    await ctx.client.cancelQueries({ queryKey: newsKeys.lists });
  },
  onSuccess: (_, __, ___, ctx) => {
    ctx.client.invalidateQueries({ queryKey: newsKeys.lists });
  },
});

export const updateNewsMutation = (id: string) =>
  mutationOptions({
    mutationFn: (body: UpdateNews) =>
      photonClient
        .patch("/api/news/{id}", body, {
          pathParams: { id },
        })
        .then((r) => r.unwrap().data),
    onMutate: async (_, ctx) => {
      await ctx.client.cancelQueries({ queryKey: newsKeys.all });
    },
    onSuccess: (_, __, ___, ctx) => {
      ctx.client.invalidateQueries({ queryKey: newsKeys.all });
    },
  });

export const deleteNewsMutation = (id: string) =>
  mutationOptions({
    mutationFn: () =>
      photonClient
        .del("/api/news/{id}", {
          pathParams: { id },
        })
        .then((r) => r.unwrap().data),
    onSuccess: (_, __, ___, ctx) => {
      ctx.client.invalidateQueries({ queryKey: newsKeys.all });
    },
  });

export const createNewsReactionMutation = (id: string) =>
  mutationOptions({
    mutationFn: (body: CreateNewsReaction) =>
      photonClient
        .post("/api/news/{id}/reactions", body, {
          pathParams: { id },
        })
        .then((r) => r.unwrap().data),
    onMutate: async (_, ctx) => {
      await ctx.client.cancelQueries({ queryKey: newsKeys.details });
    },
    onSuccess: (_, __, ___, ctx) => {
      ctx.client.invalidateQueries({ queryKey: newsKeys.details });
    },
  });

export const deleteNewsReactionMutation = (id: string) =>
  mutationOptions({
    mutationFn: () =>
      photonClient
        .del("/api/news/{id}/reactions", {
          pathParams: { id },
        })
        .then((r) => r.unwrap().data),
    onSuccess: (_, __, ___, ctx) => {
      ctx.client.invalidateQueries({ queryKey: newsKeys.details });
    },
  });
