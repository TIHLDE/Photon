import {
    infiniteQueryOptions,
    mutationOptions,
    queryOptions,
} from "@tanstack/react-query";
import { apiClient } from "#/api/api-client";
import type { QueryParamsHelper } from "@tihlde/sdk/types";
import type {
    CreateGroup,
    UpdateGroup,
    AddGroupMember,
    UpdateGroupMemberRole,
    CreateFine,
    UpdateFine,
    CreateLaw,
    UpdateLaw,
    CreateGroupForm,
} from "@tihlde/sdk";

const GroupQueryKeys = {
    listInfinite: ["groups", "list-infinite"] as const,
    list: ["groups", "list-paged"] as const,
    mine: ["groups", "mine"] as const,
    detail: ["groups", "detail"] as const,
    members: ["groups", "members"] as const,
    formerMembers: ["groups", "former-members"] as const,
    fines: ["groups", "fines"] as const,
    laws: ["groups", "laws"] as const,
    forms: ["groups", "forms"] as const,
} as const;

const DEFAULT_PAGE_SIZE = 25;

// -- Groups --

type GroupListFilters = Omit<
    QueryParamsHelper<"get", "/api/groups">,
    "page" | "pageSize"
>;

export const getGroupsQuery = (
    page: number,
    filters: GroupListFilters = {},
    pageSize: number = DEFAULT_PAGE_SIZE,
) =>
    queryOptions({
        queryKey: [...GroupQueryKeys.list, page, pageSize, filters],
        // GET /api/groups returns the full group array (no pagination).
        queryFn: () => apiClient.get("/api/groups"),
    });

export const getGroupsInfiniteQuery = (
    filters: GroupListFilters = {},
    pageSize: number = DEFAULT_PAGE_SIZE,
) =>
    infiniteQueryOptions({
        queryKey: [...GroupQueryKeys.listInfinite, pageSize, filters],
        // GET /api/groups is not paginated; the single page holds every group.
        queryFn: () => apiClient.get("/api/groups"),
        initialPageParam: 0,
        getNextPageParam: () => undefined,
    });

export const getMyGroupsQuery = () =>
    queryOptions({
        queryKey: [...GroupQueryKeys.mine],
        queryFn: () => apiClient.get("/api/groups/mine"),
    });

export const getGroupBySlugQuery = (slug: string) =>
    queryOptions({
        queryKey: [...GroupQueryKeys.detail, slug],
        queryFn: () =>
            apiClient.get("/api/groups/{slug}", {
                params: { slug },
            }),
    });

export const createGroupMutation = mutationOptions({
    mutationFn: ({ data }: { data: CreateGroup }) =>
        apiClient.post("/api/groups", {
            json: data,
        }),
    onSuccess(_, __, ___, ctx) {
        ctx.client.invalidateQueries({
            queryKey: [...GroupQueryKeys.list],
            exact: false,
        });
        ctx.client.invalidateQueries({
            queryKey: [...GroupQueryKeys.listInfinite],
            exact: false,
        });
        ctx.client.invalidateQueries({
            queryKey: [...GroupQueryKeys.mine],
            exact: false,
        });
    },
});

export const updateGroupMutation = mutationOptions({
    mutationFn: ({ slug, data }: { slug: string; data: UpdateGroup }) =>
        apiClient.patch("/api/groups/{slug}", {
            params: { slug },
            json: data,
        }),
    onSuccess(_, vars, __, ctx) {
        ctx.client.invalidateQueries(getGroupBySlugQuery(vars.slug));
        ctx.client.invalidateQueries({
            queryKey: [...GroupQueryKeys.list],
            exact: false,
        });
        ctx.client.invalidateQueries({
            queryKey: [...GroupQueryKeys.listInfinite],
            exact: false,
        });
    },
});

export const deleteGroupMutation = mutationOptions({
    mutationFn: ({ slug }: { slug: string }) =>
        apiClient.delete("/api/groups/{slug}", {
            params: { slug },
        }),
    onSuccess(_, vars, __, ctx) {
        ctx.client.invalidateQueries(getGroupBySlugQuery(vars.slug));
        ctx.client.invalidateQueries({
            queryKey: [...GroupQueryKeys.list],
            exact: false,
        });
        ctx.client.invalidateQueries({
            queryKey: [...GroupQueryKeys.listInfinite],
            exact: false,
        });
        ctx.client.invalidateQueries({
            queryKey: [...GroupQueryKeys.mine],
            exact: false,
        });
    },
});

// -- Members --

type MemberListFilters = Omit<
    QueryParamsHelper<"get", "/api/groups/{groupSlug}/members">,
    "page" | "pageSize"
>;

export const getGroupMembersQuery = (
    groupSlug: string,
    page: number,
    filters: MemberListFilters = {},
    pageSize: number = DEFAULT_PAGE_SIZE,
) =>
    queryOptions({
        queryKey: [
            ...GroupQueryKeys.members,
            groupSlug,
            page,
            pageSize,
            filters,
        ],
        queryFn: () =>
            apiClient.get("/api/groups/{groupSlug}/members", {
                params: { groupSlug },
            }),
    });

/**
 * Avsluttede medlemskap i gruppen — «Tidligere medlemmer». Nåværende
 * medlemmer er allerede filtrert bort av API-et.
 */
export const getGroupFormerMembersQuery = (groupSlug: string) =>
    queryOptions({
        queryKey: [...GroupQueryKeys.formerMembers, groupSlug],
        queryFn: () =>
            apiClient.get("/api/groups/{groupSlug}/members/history", {
                params: { groupSlug },
            }),
    });

export const addGroupMemberMutation = mutationOptions({
    mutationFn: ({
        groupSlug,
        data,
    }: {
        groupSlug: string;
        data: AddGroupMember;
    }) =>
        apiClient.post("/api/groups/{groupSlug}/members", {
            params: { groupSlug },
            json: data,
        }),
    onSuccess(_, vars, __, ctx) {
        ctx.client.invalidateQueries({
            queryKey: [...GroupQueryKeys.members, vars.groupSlug],
            exact: false,
        });
    },
});

export const updateGroupMemberRoleMutation = mutationOptions({
    mutationFn: ({
        groupSlug,
        userId,
        data,
    }: {
        groupSlug: string;
        userId: string;
        data: UpdateGroupMemberRole;
    }) =>
        apiClient.patch("/api/groups/{groupSlug}/members/{userId}", {
            params: { groupSlug, userId },
            json: data,
        }),
    onSuccess(_, vars, __, ctx) {
        ctx.client.invalidateQueries({
            queryKey: [...GroupQueryKeys.members, vars.groupSlug],
            exact: false,
        });
    },
});

export const removeGroupMemberMutation = mutationOptions({
    mutationFn: ({
        groupSlug,
        userId,
    }: {
        groupSlug: string;
        userId: string;
    }) =>
        apiClient.delete("/api/groups/{groupSlug}/members/{userId}", {
            params: { groupSlug, userId },
        }),
    onSuccess(_, vars, __, ctx) {
        ctx.client.invalidateQueries({
            queryKey: [...GroupQueryKeys.members, vars.groupSlug],
            exact: false,
        });
        // Den fjernede havner i historikken med det samme.
        ctx.client.invalidateQueries({
            queryKey: [...GroupQueryKeys.formerMembers, vars.groupSlug],
            exact: false,
        });
    },
});

// -- Fines --

type FineListFilters = Omit<
    QueryParamsHelper<"get", "/api/groups/{groupSlug}/fines">,
    "page" | "pageSize"
>;

export const getGroupFinesQuery = (
    groupSlug: string,
    page: number,
    filters: FineListFilters = {},
    pageSize: number = DEFAULT_PAGE_SIZE,
) =>
    queryOptions({
        queryKey: [...GroupQueryKeys.fines, groupSlug, page, pageSize, filters],
        queryFn: () =>
            apiClient.get("/api/groups/{groupSlug}/fines", {
                params: { groupSlug },
            }),
    });

export const getGroupFineByIdQuery = (groupSlug: string, fineId: string) =>
    queryOptions({
        queryKey: [...GroupQueryKeys.fines, groupSlug, fineId],
        queryFn: () =>
            apiClient.get("/api/groups/{groupSlug}/fines/{fineId}", {
                params: { groupSlug, fineId },
            }),
    });

export const createFineMutation = mutationOptions({
    mutationFn: ({
        groupSlug,
        data,
    }: {
        groupSlug: string;
        data: CreateFine;
    }) =>
        apiClient.post("/api/groups/{groupSlug}/fines", {
            params: { groupSlug },
            json: data,
        }),
    onSuccess(_, vars, __, ctx) {
        ctx.client.invalidateQueries({
            queryKey: [...GroupQueryKeys.fines, vars.groupSlug],
            exact: false,
        });
    },
});

export const updateFineMutation = mutationOptions({
    mutationFn: ({
        groupSlug,
        fineId,
        data,
    }: {
        groupSlug: string;
        fineId: string;
        data: UpdateFine;
    }) =>
        apiClient.patch("/api/groups/{groupSlug}/fines/{fineId}", {
            params: { groupSlug, fineId },
            json: data,
        }),
    onSuccess(_, vars, __, ctx) {
        ctx.client.invalidateQueries(
            getGroupFineByIdQuery(vars.groupSlug, vars.fineId),
        );
        ctx.client.invalidateQueries({
            queryKey: [...GroupQueryKeys.fines, vars.groupSlug],
            exact: false,
        });
    },
});

export const deleteFineMutation = mutationOptions({
    mutationFn: ({
        groupSlug,
        fineId,
    }: {
        groupSlug: string;
        fineId: string;
    }) =>
        apiClient.delete("/api/groups/{groupSlug}/fines/{fineId}", {
            params: { groupSlug, fineId },
        }),
    onSuccess(_, vars, __, ctx) {
        ctx.client.invalidateQueries(
            getGroupFineByIdQuery(vars.groupSlug, vars.fineId),
        );
        ctx.client.invalidateQueries({
            queryKey: [...GroupQueryKeys.fines, vars.groupSlug],
            exact: false,
        });
    },
});

// -- Laws (lovverk) --

export const getGroupLawsQuery = (groupSlug: string) =>
    queryOptions({
        queryKey: [...GroupQueryKeys.laws, groupSlug],
        queryFn: () =>
            apiClient.get("/api/groups/{groupSlug}/laws", {
                params: { groupSlug },
            }),
    });

export const createLawMutation = mutationOptions({
    mutationFn: ({ groupSlug, data }: { groupSlug: string; data: CreateLaw }) =>
        apiClient.post("/api/groups/{groupSlug}/laws", {
            params: { groupSlug },
            json: data,
        }),
    onSuccess(_, vars, __, ctx) {
        ctx.client.invalidateQueries({
            queryKey: [...GroupQueryKeys.laws, vars.groupSlug],
            exact: false,
        });
    },
});

export const updateLawMutation = mutationOptions({
    mutationFn: ({
        groupSlug,
        lawId,
        data,
    }: {
        groupSlug: string;
        lawId: string;
        data: UpdateLaw;
    }) =>
        apiClient.patch("/api/groups/{groupSlug}/laws/{lawId}", {
            params: { groupSlug, lawId },
            json: data,
        }),
    onSuccess(_, vars, __, ctx) {
        ctx.client.invalidateQueries({
            queryKey: [...GroupQueryKeys.laws, vars.groupSlug],
            exact: false,
        });
    },
});

export const deleteLawMutation = mutationOptions({
    mutationFn: ({ groupSlug, lawId }: { groupSlug: string; lawId: string }) =>
        apiClient.delete("/api/groups/{groupSlug}/laws/{lawId}", {
            params: { groupSlug, lawId },
        }),
    onSuccess(_, vars, __, ctx) {
        ctx.client.invalidateQueries({
            queryKey: [...GroupQueryKeys.laws, vars.groupSlug],
            exact: false,
        });
    },
});

// -- Group Forms --

export const getGroupFormsQuery = (slug: string) =>
    queryOptions({
        queryKey: [...GroupQueryKeys.forms, slug],
        queryFn: () =>
            apiClient.get("/api/groups/{slug}/forms", {
                params: { slug },
            }),
    });

export const createGroupFormMutation = mutationOptions({
    mutationFn: ({ slug, data }: { slug: string; data: CreateGroupForm }) =>
        apiClient.post("/api/groups/{slug}/forms", {
            params: { slug },
            json: data,
        }),
    onSuccess(_, vars, __, ctx) {
        ctx.client.invalidateQueries({
            queryKey: [...GroupQueryKeys.forms, vars.slug],
            exact: false,
        });
    },
});
