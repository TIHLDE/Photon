import { mutationOptions, queryOptions } from "@tanstack/react-query";
import type {
    CreateMasterStudy,
    CreateMasterStudyQuote,
    UpdateMasterStudy,
    UpdateMasterStudyQuote,
} from "@tihlde/sdk";
import type { QueryParamsHelper } from "@tihlde/sdk/types";
import { apiClient } from "#/api/api-client";

const MasterStudyQueryKeys = {
    all: ["master-study"] as const,
    list: ["master-study", "list"] as const,
    detail: ["master-study", "detail"] as const,
    studyPrograms: ["master-study", "study-programs"] as const,
} as const;

/**
 * The catalogue is a few dozen entries at most, so the page asks for all of
 * them at once and lets the API do the filtering.
 */
const PAGE_SIZE = 100;

export type MasterStudyFilters = Omit<
    QueryParamsHelper<"get", "/api/master-study">,
    "page" | "pageSize"
>;

export const getMasterStudiesQuery = (filters: MasterStudyFilters = {}) =>
    queryOptions({
        queryKey: [...MasterStudyQueryKeys.list, filters],
        queryFn: () =>
            apiClient.get("/api/master-study", {
                searchParams: { page: 0, pageSize: PAGE_SIZE, ...filters },
            }),
    });

export const getMasterStudyQuery = (id: string) =>
    queryOptions({
        queryKey: [...MasterStudyQueryKeys.detail, id],
        queryFn: () =>
            apiClient.get("/api/master-study/{id}", { params: { id } }),
    });

export const getMasterStudyProgramsQuery = () =>
    queryOptions({
        queryKey: MasterStudyQueryKeys.studyPrograms,
        queryFn: () => apiClient.get("/api/master-study/study-programs"),
    });

export const createMasterStudyMutation = mutationOptions({
    mutationFn: ({ data }: { data: CreateMasterStudy }) =>
        apiClient.post("/api/master-study", { json: data }),
    onSuccess(_, __, ___, ctx) {
        // Every write can change the list, a detail page and the counts.
        ctx.client.invalidateQueries({ queryKey: MasterStudyQueryKeys.all });
    },
});

export const updateMasterStudyMutation = mutationOptions({
    mutationFn: ({ id, data }: { id: string; data: UpdateMasterStudy }) =>
        apiClient.patch("/api/master-study/{id}", {
            params: { id },
            json: data,
        }),
    onSuccess(_, __, ___, ctx) {
        ctx.client.invalidateQueries({ queryKey: MasterStudyQueryKeys.all });
    },
});

export const deleteMasterStudyMutation = mutationOptions({
    mutationFn: ({ id }: { id: string }) =>
        apiClient.delete("/api/master-study/{id}", { params: { id } }),
    onSuccess(_, __, ___, ctx) {
        ctx.client.invalidateQueries({ queryKey: MasterStudyQueryKeys.all });
    },
});

export const createMasterStudyQuoteMutation = mutationOptions({
    mutationFn: ({
        entryId,
        data,
    }: {
        entryId: string;
        data: CreateMasterStudyQuote;
    }) =>
        apiClient.post("/api/master-study/{entryId}/quotes", {
            params: { entryId },
            json: data,
        }),
    onSuccess(_, __, ___, ctx) {
        ctx.client.invalidateQueries({ queryKey: MasterStudyQueryKeys.all });
    },
});

export const updateMasterStudyQuoteMutation = mutationOptions({
    mutationFn: ({
        entryId,
        quoteId,
        data,
    }: {
        entryId: string;
        quoteId: string;
        data: UpdateMasterStudyQuote;
    }) =>
        apiClient.patch("/api/master-study/{entryId}/quotes/{quoteId}", {
            params: { entryId, quoteId },
            json: data,
        }),
    onSuccess(_, __, ___, ctx) {
        ctx.client.invalidateQueries({ queryKey: MasterStudyQueryKeys.all });
    },
});

export const deleteMasterStudyQuoteMutation = mutationOptions({
    mutationFn: ({ entryId, quoteId }: { entryId: string; quoteId: string }) =>
        apiClient.delete("/api/master-study/{entryId}/quotes/{quoteId}", {
            params: { entryId, quoteId },
        }),
    onSuccess(_, __, ___, ctx) {
        ctx.client.invalidateQueries({ queryKey: MasterStudyQueryKeys.all });
    },
});
