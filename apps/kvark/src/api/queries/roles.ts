import { mutationOptions, queryOptions } from "@tanstack/react-query";
import type {
    CreateGroupPosition,
    CreateRole,
    UpdateGroupPosition,
    UpdateRole,
} from "@tihlde/sdk";
import { apiClient } from "#/api/api-client";

const RoleQueryKeys = {
    roles: ["roles"] as const,
    positions: ["groups", "positions"] as const,
    userSearch: ["users", "search"] as const,
} as const;

// -- User search (for assigning roles/positions by name, not ID) --

export const searchUsersQuery = (q: string) =>
    queryOptions({
        queryKey: [...RoleQueryKeys.userSearch, q],
        queryFn: () =>
            apiClient.get("/api/user/search", {
                searchParams: { q },
            }),
        staleTime: 30_000,
    });

// -- Roles --

export const getRolesQuery = () =>
    queryOptions({
        queryKey: [...RoleQueryKeys.roles],
        queryFn: () => apiClient.get("/api/roles"),
    });

export const createRoleMutation = mutationOptions({
    mutationFn: ({ data }: { data: CreateRole }) =>
        apiClient.post("/api/roles", { json: data }),
    onSuccess(_, __, ___, ctx) {
        ctx.client.invalidateQueries({ queryKey: RoleQueryKeys.roles });
    },
});

export const updateRoleMutation = mutationOptions({
    mutationFn: ({ roleId, data }: { roleId: number; data: UpdateRole }) =>
        apiClient.patch("/api/roles/{roleId}", {
            params: { roleId: String(roleId) },
            json: data,
        }),
    onSuccess(_, __, ___, ctx) {
        ctx.client.invalidateQueries({ queryKey: RoleQueryKeys.roles });
    },
});

export const deleteRoleMutation = mutationOptions({
    mutationFn: ({ roleId }: { roleId: number }) =>
        apiClient.delete("/api/roles/{roleId}", {
            params: { roleId: String(roleId) },
        }),
    onSuccess(_, __, ___, ctx) {
        ctx.client.invalidateQueries({ queryKey: RoleQueryKeys.roles });
    },
});

export const assignRoleMutation = mutationOptions({
    mutationFn: ({ roleId, userId }: { roleId: number; userId: string }) =>
        apiClient.post("/api/roles/{roleId}/users", {
            params: { roleId: String(roleId) },
            json: { userId },
        }),
    onSuccess(_, __, ___, ctx) {
        ctx.client.invalidateQueries({ queryKey: RoleQueryKeys.roles });
    },
});

export const unassignRoleMutation = mutationOptions({
    mutationFn: ({ roleId, userId }: { roleId: number; userId: string }) =>
        apiClient.delete("/api/roles/{roleId}/users/{userId}", {
            params: { roleId: String(roleId), userId },
        }),
    onSuccess(_, __, ___, ctx) {
        ctx.client.invalidateQueries({ queryKey: RoleQueryKeys.roles });
    },
});

// -- Group positions (verv/titler) --

export const getGroupPositionsQuery = (groupSlug: string) =>
    queryOptions({
        queryKey: [...RoleQueryKeys.positions, groupSlug],
        queryFn: () =>
            apiClient.get("/api/groups/{groupSlug}/positions", {
                params: { groupSlug },
            }),
    });

export const createPositionMutation = mutationOptions({
    mutationFn: ({
        groupSlug,
        data,
    }: {
        groupSlug: string;
        data: CreateGroupPosition;
    }) =>
        apiClient.post("/api/groups/{groupSlug}/positions", {
            params: { groupSlug },
            json: data,
        }),
    onSuccess(_, vars, __, ctx) {
        ctx.client.invalidateQueries({
            queryKey: [...RoleQueryKeys.positions, vars.groupSlug],
        });
    },
});

export const updatePositionMutation = mutationOptions({
    mutationFn: ({
        groupSlug,
        positionId,
        data,
    }: {
        groupSlug: string;
        positionId: string;
        data: UpdateGroupPosition;
    }) =>
        apiClient.patch("/api/groups/{groupSlug}/positions/{positionId}", {
            params: { groupSlug, positionId },
            json: data,
        }),
    onSuccess(_, vars, __, ctx) {
        ctx.client.invalidateQueries({
            queryKey: [...RoleQueryKeys.positions, vars.groupSlug],
        });
    },
});

export const deletePositionMutation = mutationOptions({
    mutationFn: ({
        groupSlug,
        positionId,
    }: {
        groupSlug: string;
        positionId: string;
    }) =>
        apiClient.delete("/api/groups/{groupSlug}/positions/{positionId}", {
            params: { groupSlug, positionId },
        }),
    onSuccess(_, vars, __, ctx) {
        ctx.client.invalidateQueries({
            queryKey: [...RoleQueryKeys.positions, vars.groupSlug],
        });
    },
});

export const assignPositionMutation = mutationOptions({
    mutationFn: ({
        groupSlug,
        positionId,
        userId,
    }: {
        groupSlug: string;
        positionId: string;
        userId: string;
    }) =>
        apiClient.post(
            "/api/groups/{groupSlug}/positions/{positionId}/holders",
            {
                params: { groupSlug, positionId },
                json: { userId },
            },
        ),
    onSuccess(_, vars, __, ctx) {
        ctx.client.invalidateQueries({
            queryKey: [...RoleQueryKeys.positions, vars.groupSlug],
        });
    },
});

export const unassignPositionMutation = mutationOptions({
    mutationFn: ({
        groupSlug,
        positionId,
        userId,
    }: {
        groupSlug: string;
        positionId: string;
        userId: string;
    }) =>
        apiClient.delete(
            "/api/groups/{groupSlug}/positions/{positionId}/holders/{userId}",
            {
                params: { groupSlug, positionId, userId },
            },
        ),
    onSuccess(_, vars, __, ctx) {
        ctx.client.invalidateQueries({
            queryKey: [...RoleQueryKeys.positions, vars.groupSlug],
        });
    },
});
