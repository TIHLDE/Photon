import {
    infiniteQueryOptions,
    mutationOptions,
    queryOptions,
} from "@tanstack/react-query";
import { apiClient } from "#/api/api-client";
import type { QueryParamsHelper } from "@tihlde/sdk/types";
import type { CreateFeedback, UpdateFeedback, VoteFeedback } from "@tihlde/sdk";

const FeedbackQueryKeys = {
    all: ["feedback"] as const,
    list: ["feedback", "list-paged"] as const,
    listInfinite: ["feedback", "list-infinite"] as const,
} as const;

const DEFAULT_PAGE_SIZE = 25;

export type FeedbackListFilters = Omit<
    QueryParamsHelper<"get", "/api/feedback">,
    "page" | "pageSize"
>;

export const getFeedbackQuery = (
    page: number,
    filters: FeedbackListFilters = {},
    pageSize: number = DEFAULT_PAGE_SIZE,
) =>
    queryOptions({
        queryKey: [...FeedbackQueryKeys.list, page, pageSize, filters],
        queryFn: () =>
            apiClient.get("/api/feedback", {
                searchParams: { page, pageSize, ...filters },
            }),
    });

export const getFeedbackInfiniteQuery = (
    filters: FeedbackListFilters = {},
    pageSize: number = DEFAULT_PAGE_SIZE,
) =>
    infiniteQueryOptions({
        queryKey: [...FeedbackQueryKeys.listInfinite, pageSize, filters],
        queryFn: ({ pageParam }) =>
            apiClient.get("/api/feedback", {
                searchParams: { page: pageParam, pageSize, ...filters },
            }),
        initialPageParam: 0,
        getNextPageParam: (lastPage) => lastPage.nextPage,
    });

export const createFeedbackMutation = mutationOptions({
    mutationFn: ({ data }: { data: CreateFeedback }) =>
        apiClient.post("/api/feedback", { json: data }),
    onSuccess(_, __, ___, ctx) {
        ctx.client.invalidateQueries({
            queryKey: FeedbackQueryKeys.all,
            exact: false,
        });
    },
});

export const updateFeedbackMutation = mutationOptions({
    mutationFn: ({
        feedbackId,
        data,
    }: {
        feedbackId: string;
        data: UpdateFeedback;
    }) =>
        apiClient.patch("/api/feedback/{id}", {
            params: { id: feedbackId },
            json: data,
        }),
    onSuccess(_, __, ___, ctx) {
        ctx.client.invalidateQueries({
            queryKey: FeedbackQueryKeys.all,
            exact: false,
        });
    },
});

export const deleteFeedbackMutation = mutationOptions({
    mutationFn: ({ feedbackId }: { feedbackId: string }) =>
        apiClient.delete("/api/feedback/{id}", {
            params: { id: feedbackId },
        }),
    onSuccess(_, __, ___, ctx) {
        ctx.client.invalidateQueries({
            queryKey: FeedbackQueryKeys.all,
            exact: false,
        });
    },
});

export const voteFeedbackMutation = mutationOptions({
    mutationFn: ({
        feedbackId,
        data,
    }: {
        feedbackId: string;
        data: VoteFeedback;
    }) =>
        apiClient.put("/api/feedback/{id}/vote", {
            params: { id: feedbackId },
            json: data,
        }),
    onSuccess(_, __, ___, ctx) {
        ctx.client.invalidateQueries({
            queryKey: FeedbackQueryKeys.all,
            exact: false,
        });
    },
});

export const deleteFeedbackVoteMutation = mutationOptions({
    mutationFn: ({ feedbackId }: { feedbackId: string }) =>
        apiClient.delete("/api/feedback/{id}/vote", {
            params: { id: feedbackId },
        }),
    onSuccess(_, __, ___, ctx) {
        ctx.client.invalidateQueries({
            queryKey: FeedbackQueryKeys.all,
            exact: false,
        });
    },
});
