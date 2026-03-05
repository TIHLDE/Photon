import { queryOptions } from "@tanstack/react-query";
import { photon } from "~/lib/api";

export const groupKeys = {
    all: ["groups"] as const,
    lists: () => [...groupKeys.all, "list"] as const,
    list: (filters: Record<string, unknown>) =>
        [...groupKeys.lists(), filters] as const,
    mine: () => [...groupKeys.all, "mine"] as const,
    details: () => [...groupKeys.all, "detail"] as const,
    detail: (slug: string) => [...groupKeys.details(), slug] as const,
    members: (slug: string) => [...groupKeys.detail(slug), "members"] as const,
    fines: (slug: string) => [...groupKeys.detail(slug), "fines"] as const,
};

export const listGroupsQuery = () =>
    queryOptions({
        queryKey: groupKeys.list({}),
        queryFn: () => photon.GET("/api/groups").then((r) => r.data),
    });

export const getGroupQuery = (slug: string) =>
    queryOptions({
        queryKey: groupKeys.detail(slug),
        queryFn: () =>
            photon
                .GET("/api/groups/{slug}", { params: { path: { slug } } })
                .then((r) => r.data),
    });

export const listMyGroupsQuery = () =>
    queryOptions({
        queryKey: groupKeys.mine(),
        queryFn: () => photon.GET("/api/groups/mine").then((r) => r.data),
    });

export const listGroupMembersQuery = (groupSlug: string) =>
    queryOptions({
        queryKey: groupKeys.members(groupSlug),
        queryFn: () =>
            photon
                .GET("/api/groups/{groupSlug}/members", {
                    params: { path: { groupSlug } },
                })
                .then((r) => r.data),
    });

export const listGroupFinesQuery = (groupSlug: string) =>
    queryOptions({
        queryKey: groupKeys.fines(groupSlug),
        queryFn: () =>
            photon
                .GET("/api/groups/{groupSlug}/fines", {
                    params: { path: { groupSlug } },
                })
                .then((r) => r.data),
    });
