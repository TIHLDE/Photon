import {
    infiniteQueryOptions,
    mutationOptions,
    queryOptions,
} from "@tanstack/react-query";
import { apiClient } from "#/api/api-client";
import type { UpdateUserSettingsInput, OnboardUserInput } from "@tihlde/sdk";

const UserQueryKeys = {
    settings: ["user", "settings"] as const,
    allergies: ["user", "allergies"] as const,
    listInfinite: ["user", "list-infinite"] as const,
} as const;

const DEFAULT_PAGE_SIZE = 50;

export type UserListFilters = {
    /** Name or username substring. */
    search?: string;
    /** STUDY group slug, or "none" for users without a study programme. */
    study?: string;
    /** Cohort (STUDYYEAR group), e.g. 2023. */
    studyStartYear?: number;
};

/**
 * Every user in the system, page by page. Filtering happens server-side so the
 * admin overview never has to hold all ~2000 users in memory.
 */
export const getUsersInfiniteQuery = (
    filters: UserListFilters = {},
    pageSize: number = DEFAULT_PAGE_SIZE,
) =>
    infiniteQueryOptions({
        queryKey: [...UserQueryKeys.listInfinite, pageSize, filters],
        queryFn: ({ pageParam }) =>
            apiClient.get("/api/user", {
                searchParams: {
                    page: pageParam,
                    pageSize,
                    ...(filters.search ? { search: filters.search } : {}),
                    ...(filters.study ? { study: filters.study } : {}),
                    ...(filters.studyStartYear === undefined
                        ? {}
                        : { studyStartYear: filters.studyStartYear }),
                },
            }),
        initialPageParam: 0,
        getNextPageParam: (lastPage) => lastPage.nextPage,
    });

export const getUserSettingsQuery = () =>
    queryOptions({
        queryKey: [...UserQueryKeys.settings],
        queryFn: () => apiClient.get("/api/user/me/settings"),
    });

export const createUserSettingsMutation = mutationOptions({
    mutationFn: ({ data }: { data: OnboardUserInput }) =>
        apiClient.post("/api/user/me/settings", {
            json: data,
        }),
    onSuccess(_, __, ___, ctx) {
        ctx.client.invalidateQueries({
            queryKey: [...UserQueryKeys.settings],
            exact: false,
        });
    },
});

export const updateUserSettingsMutation = mutationOptions({
    mutationFn: ({ data }: { data: UpdateUserSettingsInput }) =>
        apiClient.patch("/api/user/me/settings", {
            json: data,
        }),
    onSuccess(_, __, ___, ctx) {
        ctx.client.invalidateQueries({
            queryKey: [...UserQueryKeys.settings],
            exact: false,
        });
    },
});

export const getAllergiesQuery = () =>
    queryOptions({
        queryKey: [...UserQueryKeys.allergies],
        queryFn: () => apiClient.get("/api/user/allergy"),
    });
