import { mutationOptions, queryOptions } from "@tanstack/react-query";
import { apiClient } from "#/api/api-client";
import type { CreateContract } from "@tihlde/sdk";

const ContractQueryKeys = {
    active: ["contracts", "active"] as const,
    mySignature: ["contracts", "my-signature"] as const,
    list: ["contracts", "list"] as const,
    groupSignatures: ["contracts", "group-signatures"] as const,
} as const;

export const getActiveContractQuery = () =>
    queryOptions({
        queryKey: [...ContractQueryKeys.active],
        queryFn: () => apiClient.get("/api/contracts/active"),
    });

export const getMySignatureQuery = () =>
    queryOptions({
        queryKey: [...ContractQueryKeys.mySignature],
        queryFn: () => apiClient.get("/api/contracts/my-signature"),
        retry: false,
    });

export const getContractListQuery = () =>
    queryOptions({
        queryKey: [...ContractQueryKeys.list],
        queryFn: () => apiClient.get("/api/contracts"),
    });

export const getGroupSignaturesQuery = (groupSlug: string) =>
    queryOptions({
        queryKey: [...ContractQueryKeys.groupSignatures, groupSlug],
        queryFn: () =>
            apiClient.get("/api/contracts/groups/{groupSlug}/signatures", {
                params: { groupSlug },
            }),
    });

export const signContractMutation = mutationOptions({
    mutationFn: () => apiClient.post("/api/contracts/sign"),
    onSuccess(_, __, ___, ctx) {
        ctx.client.invalidateQueries({
            queryKey: [...ContractQueryKeys.mySignature],
            exact: false,
        });
    },
});

export const createContractMutation = mutationOptions({
    mutationFn: (data: CreateContract) =>
        apiClient.post("/api/contracts", { json: data }),
    onSuccess(_, __, ___, ctx) {
        ctx.client.invalidateQueries({
            queryKey: [...ContractQueryKeys.list],
            exact: false,
        });
    },
});

export const activateContractMutation = mutationOptions({
    mutationFn: ({ id }: { id: string }) =>
        apiClient.patch("/api/contracts/{id}/activate", { params: { id } }),
    onSuccess(_, __, ___, ctx) {
        ctx.client.invalidateQueries({
            queryKey: [...ContractQueryKeys.list],
            exact: false,
        });
        ctx.client.invalidateQueries({
            queryKey: [...ContractQueryKeys.active],
            exact: false,
        });
    },
});

export const revokeSignatureMutation = mutationOptions({
    mutationFn: ({
        groupSlug,
        userId,
    }: {
        groupSlug: string;
        userId: string;
    }) =>
        apiClient.delete(
            "/api/contracts/groups/{groupSlug}/signatures/{userId}",
            { params: { groupSlug, userId } },
        ),
    onSuccess(_, vars, __, ctx) {
        ctx.client.invalidateQueries({
            queryKey: [...ContractQueryKeys.groupSignatures, vars.groupSlug],
            exact: false,
        });
    },
});
