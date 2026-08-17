import { mutationOptions, queryOptions } from "@tanstack/react-query";
import type { CreateGroupPosition, UpdateGroupPosition } from "@tihlde/sdk";
import { apiClient } from "#/api/api-client";

const RoleQueryKeys = {
    positions: ["groups", "positions"] as const,
    leaderPermissions: ["groups", "leader-permissions"] as const,
    memberPermissions: ["groups", "member-permissions"] as const,
    userSearch: ["users", "search"] as const,
} as const;

// -- User search (for assigning roles/positions by name, not ID) --

/**
 * `groupSlug` sendes med når søket skjer på vegne av en gruppe. Da slipper
 * gruppens leder gjennom uten `users:view` — ellers ville et søk hen har lov
 * til å handle på (legge til medlem) svart 403 og sett ut som «ingen treff».
 */
export const searchUsersQuery = (q: string, groupSlug?: string) =>
    queryOptions({
        queryKey: [...RoleQueryKeys.userSearch, q, groupSlug ?? null],
        queryFn: () =>
            apiClient.get("/api/user/search", {
                searchParams: groupSlug ? { q, groupSlug } : { q },
            }),
        staleTime: 30_000,
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

// -- Leader permissions (the group's leader row in the verv table) --

/**
 * The permissions the group's leader holds, scoped to that group. Only
 * readable by someone who may manage the group's verv, so this 403s for
 * everyone else — hence the separate query rather than a field on the group.
 */
export const getLeaderPermissionsQuery = (groupSlug: string) =>
    queryOptions({
        queryKey: [...RoleQueryKeys.leaderPermissions, groupSlug],
        queryFn: () =>
            apiClient.get("/api/groups/{groupSlug}/leader-permissions", {
                params: { groupSlug },
            }),
    });

export const updateLeaderPermissionsMutation = mutationOptions({
    mutationFn: ({
        groupSlug,
        permissions,
        globalPermissions,
        title,
    }: {
        groupSlug: string;
        permissions: string[];
        /** Omit to leave the org-wide list unchanged (a group leader may not write it). */
        globalPermissions?: string[];
        /** Omit to leave the group's name for the role unchanged. */
        title?: string | null;
    }) =>
        apiClient.patch("/api/groups/{groupSlug}/leader-permissions", {
            params: { groupSlug },
            json: { permissions, globalPermissions, title },
        }),
    onSuccess(_, vars, __, ctx) {
        ctx.client.invalidateQueries({
            queryKey: [...RoleQueryKeys.leaderPermissions, vars.groupSlug],
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

// -- Member permissions (the group's "Alle medlemmer" row) --

/**
 * What every member of the group holds — `permissions` scoped to the group,
 * `globalPermissions` across all of TIHLDE. Gated behind the same right as
 * managing the group's verv, so this 403s for everyone else; hence a separate
 * query rather than a field on the group.
 */
export const getMemberPermissionsQuery = (groupSlug: string) =>
    queryOptions({
        queryKey: [...RoleQueryKeys.memberPermissions, groupSlug],
        queryFn: () =>
            apiClient.get("/api/groups/{groupSlug}/member-permissions", {
                params: { groupSlug },
            }),
    });

export const updateMemberPermissionsMutation = mutationOptions({
    mutationFn: ({
        groupSlug,
        permissions,
        globalPermissions,
    }: {
        groupSlug: string;
        permissions: string[];
        globalPermissions: string[];
    }) =>
        apiClient.patch("/api/groups/{groupSlug}/member-permissions", {
            params: { groupSlug },
            json: { permissions, globalPermissions },
        }),
    onSuccess(_, vars, __, ctx) {
        ctx.client.invalidateQueries({
            queryKey: [...RoleQueryKeys.memberPermissions, vars.groupSlug],
        });
    },
});
