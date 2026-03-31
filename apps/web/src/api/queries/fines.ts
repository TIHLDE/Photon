import { mutationOptions, queryOptions } from "@tanstack/react-query";

import { photonClient } from "../apiClient";
import type { CreateFine, UpdateFine } from "@tihlde/sdk";

export type { CreateFine, UpdateFine, Fine, FineList, UpdateFineResponse } from "@tihlde/sdk";

export const fineKeys = {
  all: ["fines"],
  lists: ["fines", "list"],
  details: ["fines", "detail"],
} as const;

export const listFinesQuery = (groupSlug: string) =>
  queryOptions({
    queryKey: [...fineKeys.lists, groupSlug],
    queryFn: () =>
      photonClient
        .get("/api/groups/{groupSlug}/fines", {
          pathParams: { groupSlug },
        })
        .then((r) => r.unwrap().data),
  });

export const getFineQuery = (groupSlug: string, fineId: string) =>
  queryOptions({
    queryKey: [...fineKeys.details, groupSlug, fineId],
    queryFn: () =>
      photonClient
        .get("/api/groups/{groupSlug}/fines/{fineId}", {
          pathParams: { groupSlug, fineId },
        })
        .then((r) => r.unwrap().data),
  });

export const createFineMutation = (groupSlug: string) =>
  mutationOptions({
    mutationFn: (body: CreateFine) =>
      photonClient
        .post("/api/groups/{groupSlug}/fines", body, {
          pathParams: { groupSlug },
        })
        .then((r) => r.unwrap().data),
    onMutate: async (_, ctx) => {
      await ctx.client.cancelQueries({ queryKey: fineKeys.lists });
    },
    onSuccess: (_, __, ___, ctx) => {
      ctx.client.invalidateQueries({ queryKey: fineKeys.lists });
    },
  });

export const updateFineMutation = (groupSlug: string, fineId: string) =>
  mutationOptions({
    mutationFn: (body: UpdateFine) =>
      photonClient
        .patch("/api/groups/{groupSlug}/fines/{fineId}", body, {
          pathParams: { groupSlug, fineId },
        })
        .then((r) => r.unwrap().data),
    onMutate: async (_, ctx) => {
      await ctx.client.cancelQueries({ queryKey: fineKeys.all });
    },
    onSuccess: (_, __, ___, ctx) => {
      ctx.client.invalidateQueries({ queryKey: fineKeys.all });
    },
  });

export const deleteFineMutation = (groupSlug: string, fineId: string) =>
  mutationOptions({
    mutationFn: () =>
      photonClient
        .del("/api/groups/{groupSlug}/fines/{fineId}", {
          pathParams: { groupSlug, fineId },
        })
        .then((r) => r.unwrap().data),
    onSuccess: (_, __, ___, ctx) => {
      ctx.client.invalidateQueries({ queryKey: fineKeys.all });
    },
  });
