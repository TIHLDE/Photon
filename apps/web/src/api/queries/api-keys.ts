import { mutationOptions, queryOptions } from "@tanstack/react-query";
import { CreateApiKey, UpdateApiKey } from "@tihlde/sdk";
import { photonClient } from "~/api/apiClient";

export type {
  ApiKey,
  ApiKeyList,
  CreateApiKey,
  CreateApiKeyResponse,
  DeleteApiKeyResponse,
  UpdateApiKey,
  ValidateApiKeyInput,
  ValidateApiKeyResponse,
} from "@tihlde/sdk";

export const apiKeyKeys = {
  all: ["api-keys"],
  lists: ["api-keys", "list"],
  details: ["api-keys", "detail"],
} as const;

export const listApiKeysQuery = () =>
  queryOptions({
    queryKey: apiKeyKeys.lists,
    queryFn: () => photonClient.get("/api/api-keys").then((r) => r.unwrap().data),
  });

export const getApiKeyQuery = (id: string) =>
  queryOptions({
    queryKey: [...apiKeyKeys.details, id],
    queryFn: () =>
      photonClient
        .get("/api/api-keys/{id}", {
          pathParams: {
            id,
          },
        })
        .then((r) => r.unwrap().data),
  });

export const createApiKeyMutation = mutationOptions({
  mutationFn: (body: CreateApiKey) => photonClient.post("/api/api-keys", body).then((r) => r.unwrap().data),
  onMutate: async (_, ctx) => {
    await ctx.client.cancelQueries({ queryKey: apiKeyKeys.lists });
  },
  onSuccess: (_, __, ___, ctx) => {
    ctx.client.invalidateQueries({ queryKey: apiKeyKeys.lists });
  },
});

export const updateApiKeyMutation = (id: string) =>
  mutationOptions({
    mutationFn: (body: UpdateApiKey) =>
      photonClient
        .patch("/api/api-keys/{id}", body, {
          pathParams: {
            id,
          },
        })
        .then((r) => r.unwrap().data),
    onMutate: async (_, ctx) => {
      await ctx.client.cancelQueries({ queryKey: apiKeyKeys.all });
    },
    onSuccess: (_, __, ___, ctx) => {
      ctx.client.invalidateQueries({ queryKey: apiKeyKeys.all });
    },
  });

export const deleteApiKeyMutation = (id: string) =>
  mutationOptions({
    mutationFn: () =>
      photonClient
        .del("/api/api-keys/{id}", {
          pathParams: {
            id,
          },
        })
        .then((r) => r.unwrap().data),
    onSuccess: (_, __, ___, ctx) => {
      ctx.client.invalidateQueries({ queryKey: apiKeyKeys.all });
    },
  });

export const regenerateApiKeyMutation = (id: string) =>
  mutationOptions({
    mutationFn: () =>
      photonClient
        .post("/api/api-keys/{id}/regenerate", undefined, {
          pathParams: {
            id,
          },
        })
        .then((r) => r.unwrap().data),
    onSuccess: (_, __, ___, ctx) => {
      ctx.client.invalidateQueries({ queryKey: apiKeyKeys.all });
    },
  });
