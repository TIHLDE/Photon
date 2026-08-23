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
    unansweredEvaluations: ["user", "unanswered-evaluations"] as const,
    listInfinite: ["user", "list-infinite"] as const,
    profile: ["user", "profile"] as const,
    calendarSubscription: ["user", "calendar-subscription"] as const,
} as const;

const DEFAULT_PAGE_SIZE = 50;

export type UserListFilters = {
    /** Name or username substring. */
    search?: string;
    /** STUDY group slug, or "none" for users without a study programme. */
    study?: string;
    /** Cohort (STUDYYEAR group), e.g. 2023. */
    studyStartYear?: number;
    /**
     * "pending" er køen av selvregistrerte brukere som venter på at en
     * administrator godkjenner dem.
     */
    approvalStatus?: "pending" | "approved";
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
                    ...(filters.approvalStatus
                        ? { approvalStatus: filters.approvalStatus }
                        : {}),
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

/**
 * Evalueringene medlemmet skylder svar på.
 *
 * Så lenge lista ikke er tom nekter API-et nye påmeldinger, så den er både
 * en huskeliste og forklaringen på hvorfor påmelding plutselig ikke går.
 */
export const getUnansweredEvaluationsQuery = () =>
    queryOptions({
        queryKey: [...UserQueryKeys.unansweredEvaluations],
        queryFn: () => apiClient.get("/api/user/me/unanswered-evaluations"),
    });

/**
 * Allergikatalogen.
 *
 * Send `curated` for alt et medlem skal velge fra: hele katalogen inneholder
 * også fritekstsvarene Lepton-importen dro med seg, som er hundrevis av
 * nesten like rader.
 */
export const getAllergiesQuery = (options?: { curated?: boolean }) =>
    queryOptions({
        queryKey: [...UserQueryKeys.allergies, options?.curated ?? false],
        queryFn: () =>
            apiClient.get("/api/user/allergy", {
                searchParams: options?.curated ? { curated: "true" } : {},
            }),
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
 * Flytt et medlem mellom `member` og `alumni`.
 *
 * Forskjellen er én ting: alumni kan ikke melde seg på arrangementer. Alt
 * annet — profil, grupper, historikk, sidene de kan lese — er likt.
 *
 * Trengs fordi ingen av de to stedene rollen settes automatisk treffer alltid:
 * Feide bestemmer på nytt bare når medlemmet logger inn med Feide, og
 * godkjenning av en selvregistrert konto gir alltid `member`.
 */
export const updateUserBaselineRoleMutation = mutationOptions({
    mutationFn: ({
        userId,
        role,
    }: {
        userId: string;
        role: "member" | "alumni";
    }) =>
        apiClient.patch("/api/user/{id}/baseline-role", {
            params: { id: userId },
            json: { role },
        }),
    onSuccess(_, __, ___, ctx) {
        ctx.client.invalidateQueries({
            queryKey: [...UserQueryKeys.listInfinite],
            exact: false,
        });
    },
});

/**
 * Godkjenn en bruker som har registrert seg selv.
 *
 * Gir rollen admin velger — «medlem» som før, eller «alumni» for en tidligere
 * student som ikke skal kunne melde seg på arrangementer — og sender en e-post
 * om at brukeren er klar til bruk. Uten dette står kontoen uten roller og
 * kommer ingen vei.
 */
export const approveUserMutation = mutationOptions({
    mutationFn: ({
        userId,
        role,
    }: {
        userId: string;
        role: "member" | "alumni";
    }) =>
        apiClient.post("/api/user/{id}/approve", {
            params: { id: userId },
            json: { role },
        }),
    onSuccess(_, __, ___, ctx) {
        ctx.client.invalidateQueries({
            queryKey: [...UserQueryKeys.listInfinite],
            exact: false,
        });
    },
});

/**
 * Slett et medlem for godt.
 *
 * Motstykket til arkivering: kontoen forsvinner, og med den påmeldinger,
 * betalinger, bøter, medlemskap og vervhistorikk. Bruk arkivering med mindre
 * selve raden må bort — duplikatkontoer, testbrukere eller sletting etter GDPR.
 */
export const deleteUserMutation = mutationOptions({
    mutationFn: ({ userId }: { userId: string }) =>
        apiClient.delete("/api/user/{id}", { params: { id: userId } }),
    onSuccess(_, __, ___, ctx) {
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

/**
 * Rett studiet til et medlem for hånd.
 *
 * Studiegrupper er avledet fra Feide, så medlemslista nekter å redigere dem.
 * De fleste medlemmene kom fra Lepton med studiet den gamle databasen hadde,
 * og for dem er dette eneste veien inn. Medlemmet flyttes til den nye gruppa
 * og ut av den gamle — ett studie av gangen.
 */
export const updateUserStudyMutation = mutationOptions({
    mutationFn: ({
        userId,
        studyProgramSlug,
    }: {
        userId: string;
        studyProgramSlug: string | null;
    }) =>
        apiClient.patch("/api/user/{id}/study", {
            params: { id: userId },
            json: { studyProgramSlug },
        }),
    onSuccess(_, __, ___, ctx) {
        // Studiet vises både i admin-lista og på profilen.
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

/**
 * Rett kullet til et medlem for hånd.
 *
 * Feide gir ikke kull for alle studier, så året utledes for digfor og
 * masteren. Denne overstyrer utledningen permanent — synken rører aldri et
 * kull som er satt manuelt — og treffer bare ett studie om gangen.
 */
export const updateUserStudyYearMutation = mutationOptions({
    mutationFn: ({
        userId,
        startYear,
        studyProgramSlug,
    }: {
        userId: string;
        startYear: number | null;
        /**
         * Hvilket studie året gjelder. Utelates normalt — da treffer
         * rettingen studiet medlemmet går på nå. Bare de som har byttet
         * studium har mer enn ett.
         */
        studyProgramSlug?: string | null;
    }) =>
        apiClient.patch("/api/user/{id}/study-year", {
            params: { id: userId },
            json: { startYear, studyProgramSlug },
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

/**
 * Den personlige .ics-lenken brukeren abonnerer på i kalenderen sin. Lenken
 * lages på serveren første gang den hentes, så spørringen kjøres først når
 * brukeren faktisk åpner kalender-seksjonen.
 */
export const getCalendarSubscriptionQuery = () =>
    queryOptions({
        queryKey: [...UserQueryKeys.calendarSubscription],
        queryFn: () => apiClient.get("/api/user/me/calendar"),
        // Lenken endrer seg aldri av seg selv.
        staleTime: Number.POSITIVE_INFINITY,
    });

/** Lager en ny lenke og gjør den gamle ubrukelig. */
export const regenerateCalendarSubscriptionMutation = mutationOptions({
    mutationFn: () => apiClient.post("/api/user/me/calendar/regenerate"),
    onSuccess(data, _, __, ctx) {
        ctx.client.setQueryData([...UserQueryKeys.calendarSubscription], data);
    },
});
