import { mutationOptions, queryOptions } from "@tanstack/react-query";
import { TypedStatusError } from "@photon/codegen";
import { apiClient } from "#/api/api-client";
import type { CreateContract, SignContract } from "@photon/codegen";

const ContractQueryKeys = {
    active: ["contracts", "active"] as const,
    mySignature: ["contracts", "my-signature"] as const,
    list: ["contracts", "list"] as const,
    groupSignatures: ["contracts", "group-signatures"] as const,
} as const;

export const getActiveContractQuery = () =>
    queryOptions({
        queryKey: [...ContractQueryKeys.active],
        // Returns null (instead of throwing) when there is no active contract,
        // so callers can render an empty state rather than an error boundary.
        queryFn: async () => {
            try {
                return await apiClient.get("/api/contracts/active");
            } catch (error) {
                if (
                    error instanceof TypedStatusError &&
                    error.response.status === 404
                ) {
                    return null;
                }
                throw error;
            }
        },
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
                path: { groupSlug },
            }),
    });

export const signContractMutation = mutationOptions({
    mutationFn: (data: SignContract) =>
        apiClient.post("/api/contracts/sign", { body: data }),
    onSuccess(_, __, ___, ctx) {
        ctx.client.invalidateQueries({
            queryKey: [...ContractQueryKeys.mySignature],
            exact: false,
        });
    },
});

export const createContractMutation = mutationOptions({
    mutationFn: (data: CreateContract) =>
        apiClient.post("/api/contracts", { body: data }),
    onSuccess(_, __, ___, ctx) {
        ctx.client.invalidateQueries({
            queryKey: [...ContractQueryKeys.list],
            exact: false,
        });
    },
});

export const activateContractMutation = mutationOptions({
    mutationFn: ({ id }: { id: string }) =>
        apiClient.patch("/api/contracts/{id}/activate", { path: { id } }),
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
            { path: { groupSlug, userId } },
        ),
    onSuccess(_, vars, __, ctx) {
        ctx.client.invalidateQueries({
            queryKey: [...ContractQueryKeys.groupSignatures, vars.groupSlug],
            exact: false,
        });
    },
});
