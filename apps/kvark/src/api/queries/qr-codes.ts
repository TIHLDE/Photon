import { mutationOptions, queryOptions } from "@tanstack/react-query";
import { apiClient } from "#/api/api-client";
import type { CreateQRCode } from "@tihlde/sdk";

const QRCodeQueryKeys = {
    list: ["qr-codes", "list"] as const,
} as const;

/**
 * A member's own codes in one call — the list is theirs alone and rarely more
 * than a handful, so paging it would cost more than it saves.
 */
export const getQRCodesQuery = () =>
    queryOptions({
        queryKey: QRCodeQueryKeys.list,
        queryFn: () => apiClient.get("/api/qr-codes"),
    });

export const createQRCodeMutation = mutationOptions({
    mutationFn: ({ data }: { data: CreateQRCode }) =>
        apiClient.post("/api/qr-codes", { json: data }),
    onSuccess(_, __, ___, ctx) {
        ctx.client.invalidateQueries({ queryKey: QRCodeQueryKeys.list });
    },
});

export const deleteQRCodeMutation = mutationOptions({
    mutationFn: ({ qrCodeId }: { qrCodeId: string }) =>
        apiClient.delete("/api/qr-codes/{id}", { params: { id: qrCodeId } }),
    onSuccess(_, __, ___, ctx) {
        ctx.client.invalidateQueries({ queryKey: QRCodeQueryKeys.list });
    },
});
