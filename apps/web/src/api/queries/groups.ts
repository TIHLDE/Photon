import { mutationOptions, queryOptions } from "@tanstack/react-query";

import { photonClient } from "../apiClient";

export type {
  Group,
  GroupFormList,
  GroupList,
  GroupMember,
  GroupMemberList,
  GroupMembership,
  UpdateGroupResponse,
  UpdateMemberRoleResponse,
  CreateGroupFormResponse,
} from "@tihlde/sdk";

export const groupKeys = {
  all: ["groups"],
  lists: ["groups", "list"],
  details: ["groups", "detail"],
  members: ["groups", "members"],
  forms: ["groups", "forms"],
} as const;

export const listGroupsQuery = () =>
  queryOptions({
    queryKey: groupKeys.lists,
    queryFn: () => photonClient.get("/api/groups").then((r) => r.unwrap().data),
  });

export const getGroupQuery = (slug: string) =>
  queryOptions({
    queryKey: [...groupKeys.details, slug],
    queryFn: () =>
      photonClient
        .get("/api/groups/{slug}", {
          pathParams: { slug },
        })
        .then((r) => r.unwrap().data),
  });

export const listGroupMembersQuery = (groupSlug: string) =>
  queryOptions({
    queryKey: [...groupKeys.members, groupSlug],
    queryFn: () =>
      photonClient
        .get("/api/groups/{groupSlug}/members", {
          pathParams: { groupSlug },
        })
        .then((r) => r.unwrap().data),
  });

export const listGroupFormsQuery = (slug: string) =>
  queryOptions({
    queryKey: [...groupKeys.forms, slug],
    queryFn: () =>
      photonClient
        .get("/api/groups/{slug}/forms", {
          pathParams: { slug },
        })
        .then((r) => r.unwrap().data),
  });

export const createGroupMutation = mutationOptions({
  mutationFn: (body: Parameters<typeof photonClient.post<"/api/groups">>[1]) => photonClient.post("/api/groups", body).then((r) => r.unwrap().data),
  onMutate: async (_, ctx) => {
    await ctx.client.cancelQueries({ queryKey: groupKeys.lists });
  },
  onSuccess: (_, __, ___, ctx) => {
    ctx.client.invalidateQueries({ queryKey: groupKeys.lists });
  },
});

export const updateGroupMutation = (slug: string) =>
  mutationOptions({
    mutationFn: (body: Parameters<typeof photonClient.patch<"/api/groups/{slug}">>[1]) =>
      photonClient
        .patch("/api/groups/{slug}", body, {
          pathParams: { slug },
        })
        .then((r) => r.unwrap().data),
    onMutate: async (_, ctx) => {
      await ctx.client.cancelQueries({ queryKey: groupKeys.all });
    },
    onSuccess: (_, __, ___, ctx) => {
      ctx.client.invalidateQueries({ queryKey: groupKeys.all });
    },
  });

export const deleteGroupMutation = (slug: string) =>
  mutationOptions({
    mutationFn: () =>
      photonClient
        .del("/api/groups/{slug}", {
          pathParams: { slug },
        })
        .then((r) => r.unwrap().data),
    onSuccess: (_, __, ___, ctx) => {
      ctx.client.invalidateQueries({ queryKey: groupKeys.all });
    },
  });

export const addGroupMemberMutation = (groupSlug: string) =>
  mutationOptions({
    mutationFn: (body: Parameters<typeof photonClient.post<"/api/groups/{groupSlug}/members">>[1]) =>
      photonClient
        .post("/api/groups/{groupSlug}/members", body, {
          pathParams: { groupSlug },
        })
        .then((r) => r.unwrap().data),
    onMutate: async (_, ctx) => {
      await ctx.client.cancelQueries({ queryKey: groupKeys.members });
    },
    onSuccess: (_, __, ___, ctx) => {
      ctx.client.invalidateQueries({ queryKey: groupKeys.members });
    },
  });

export const removeGroupMemberMutation = (groupSlug: string, userId: string) =>
  mutationOptions({
    mutationFn: () =>
      photonClient
        .del("/api/groups/{groupSlug}/members/{userId}", {
          pathParams: { groupSlug, userId },
        })
        .then((r) => r.unwrap().data),
    onSuccess: (_, __, ___, ctx) => {
      ctx.client.invalidateQueries({ queryKey: groupKeys.members });
    },
  });

export const updateGroupMemberRoleMutation = (groupSlug: string, userId: string) =>
  mutationOptions({
    mutationFn: (body: Parameters<typeof photonClient.patch<"/api/groups/{groupSlug}/members/{userId}">>[1]) =>
      photonClient
        .patch("/api/groups/{groupSlug}/members/{userId}", body, {
          pathParams: { groupSlug, userId },
        })
        .then((r) => r.unwrap().data),
    onMutate: async (_, ctx) => {
      await ctx.client.cancelQueries({ queryKey: groupKeys.members });
    },
    onSuccess: (_, __, ___, ctx) => {
      ctx.client.invalidateQueries({ queryKey: groupKeys.members });
    },
  });

export const createGroupFormMutation = (slug: string) =>
  mutationOptions({
    mutationFn: (body: Parameters<typeof photonClient.post<"/api/groups/{slug}/forms">>[1]) =>
      photonClient
        .post("/api/groups/{slug}/forms", body, {
          pathParams: { slug },
        })
        .then((r) => r.unwrap().data),
    onMutate: async (_, ctx) => {
      await ctx.client.cancelQueries({ queryKey: groupKeys.forms });
    },
    onSuccess: (_, __, ___, ctx) => {
      ctx.client.invalidateQueries({ queryKey: groupKeys.forms });
    },
  });
