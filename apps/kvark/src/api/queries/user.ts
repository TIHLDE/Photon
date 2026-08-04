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
    userAllergies: ["user", "allergies-for-user"] as const,
    listInfinite: ["user", "list-infinite"] as const,
    profile: ["user", "profile"] as const,
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

/**
 * Another member's profile. Narrower than the session on purpose — it carries
 * no e-mail, allergies or settings — so use the session when the profile being
 * shown is the viewer's own.
 */
export const getUserProfileQuery = (userId: string) =>
    queryOptions({
        queryKey: [...UserQueryKeys.profile, userId],
        queryFn: () =>
            apiClient.get("/api/user/{id}", { params: { id: userId } }),
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
        // Bio og lenker vises fra profil-endepunktet, ikke fra settings, så
        // profilen må hentes på nytt for at endringene skal vises uten refresh.
        ctx.client.invalidateQueries({
            queryKey: [...UserQueryKeys.profile],
            exact: false,
        });
    },
});

export const getAllergiesQuery = () =>
    queryOptions({
        queryKey: [...UserQueryKeys.allergies],
        queryFn: () => apiClient.get("/api/user/allergy"),
    });

/**
 * Allergiene til ett medlem. Bare for `users:manage` — profilendepunktet
 * holder allergier utenfor med vilje.
 */
export const getUserAllergiesQuery = (userId: string) =>
    queryOptions({
        queryKey: [...UserQueryKeys.userAllergies, userId],
        queryFn: () =>
            apiClient.get("/api/user/{id}/allergies", {
                params: { id: userId },
            }),
    });

export const updateUserAllergiesMutation = mutationOptions({
    mutationFn: ({
        userId,
        allergies,
    }: {
        userId: string;
        allergies: string[];
    }) =>
        apiClient.put("/api/user/{id}/allergies", {
            params: { id: userId },
            json: { allergies },
        }),
    onSuccess(_, vars, __, ctx) {
        ctx.client.invalidateQueries({
            queryKey: [...UserQueryKeys.userAllergies, vars.userId],
            exact: false,
        });
    },
});

/**
 * Steng et medlem ute, eller slipp dem inn igjen.
 *
 * Kontoen består — påmeldinger, bøter og vervhistorikk peker på den — men
 * medlemmet kan ikke logge inn, og sesjonene deres avsluttes umiddelbart.
 */
export const updateUserStatusMutation = mutationOptions({
    mutationFn: ({
        userId,
        isActive,
        reason,
    }: {
        userId: string;
        isActive: boolean;
        reason?: string;
    }) =>
        apiClient.patch("/api/user/{id}/status", {
            params: { id: userId },
            json: { isActive, ...(reason ? { reason } : {}) },
        }),
    onSuccess(_, __, ___, ctx) {
        ctx.client.invalidateQueries({
            queryKey: [...UserQueryKeys.listInfinite],
            exact: false,
        });
    },
});

/**
 * Rett kullet til et medlem for hånd.
 *
 * Feide gir ikke kull for alle studier, så nye medlemmer antas å være
 * 1. klassinger. Denne overstyrer den antakelsen permanent — synken rører
 * aldri et kull som er satt manuelt.
 */
export const updateUserStudyYearMutation = mutationOptions({
    mutationFn: ({
        userId,
        startYear,
    }: {
        userId: string;
        startYear: number | null;
    }) =>
        apiClient.patch("/api/user/{id}/study-year", {
            params: { id: userId },
            json: { startYear },
        }),
    onSuccess(_, __, ___, ctx) {
        // Kullet vises både i admin-lista og på profilen.
        ctx.client.invalidateQueries({
            queryKey: [...UserQueryKeys.listInfinite],
            exact: false,
        });
        ctx.client.invalidateQueries({
            queryKey: [...UserQueryKeys.profile],
            exact: false,
        });
    },
});
