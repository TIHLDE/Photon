import { mutationOptions, queryOptions } from "@tanstack/react-query";
import type { components } from "@tihlde/sdk";
import { apiClient } from "#/api/api-client";
import { fetchPrivateObjectUrl } from "#/lib/assets";

export type ApplicationSummary = components["schemas"]["ApplicationSummary"];
export type ApplicationDetail = components["schemas"]["ApplicationDetail"];
export type ApplicationOptions = components["schemas"]["ApplicationOptions"];
export type CreateExpenseApplication =
    components["schemas"]["CreateExpenseApplication"];
export type CreateSupportApplication =
    components["schemas"]["CreateSupportApplication"];
export type CreateHsCaseApplication =
    components["schemas"]["CreateHsCaseApplication"];
export type UpdateApplicationStatus =
    components["schemas"]["UpdateApplicationStatus"];

export type ApplicationType = ApplicationSummary["type"];
export type ApplicationStatus = ApplicationSummary["status"];

const ApplicationQueryKeys = {
    all: ["applications"] as const,
    list: ["applications", "list"] as const,
    mine: ["applications", "mine"] as const,
    detail: ["applications", "detail"] as const,
    options: ["applications", "options"] as const,
} as const;

export const getApplicationOptionsQuery = () =>
    queryOptions({
        queryKey: [...ApplicationQueryKeys.options],
        queryFn: () => apiClient.get("/api/applications/options"),
        // The group list changes maybe once a semester.
        staleTime: 5 * 60 * 1000,
    });

export const getMyApplicationsQuery = () =>
    queryOptions({
        queryKey: [...ApplicationQueryKeys.mine],
        queryFn: () => apiClient.get("/api/applications/mine"),
    });

export const getApplicationsQuery = (filters?: {
    type?: ApplicationType;
    status?: ApplicationStatus;
}) =>
    queryOptions({
        queryKey: [...ApplicationQueryKeys.list, filters ?? {}],
        queryFn: () =>
            apiClient.get("/api/applications", {
                searchParams: {
                    ...(filters?.type ? { type: filters.type } : {}),
                    ...(filters?.status ? { status: filters.status } : {}),
                },
            }),
    });

export const getApplicationQuery = (id: string) =>
    queryOptions({
        queryKey: [...ApplicationQueryKeys.detail, id],
        queryFn: () =>
            apiClient.get("/api/applications/{id}", { params: { id } }),
    });

function invalidateApplications(client: {
    invalidateQueries: (filters: { queryKey: readonly unknown[] }) => unknown;
}) {
    client.invalidateQueries({ queryKey: ApplicationQueryKeys.all });
}

export const createExpenseApplicationMutation = mutationOptions({
    mutationFn: (data: CreateExpenseApplication) =>
        apiClient.post("/api/applications/expense", { json: data }),
    onSuccess(_, __, ___, ctx) {
        invalidateApplications(ctx.client);
    },
});

export const createSupportApplicationMutation = mutationOptions({
    mutationFn: (data: CreateSupportApplication) =>
        apiClient.post("/api/applications/support", { json: data }),
    onSuccess(_, __, ___, ctx) {
        invalidateApplications(ctx.client);
    },
});

export const createSportsSupportApplicationMutation = mutationOptions({
    mutationFn: (data: CreateSupportApplication) =>
        apiClient.post("/api/applications/sports-support", { json: data }),
    onSuccess(_, __, ___, ctx) {
        invalidateApplications(ctx.client);
    },
});

export const createHsCaseApplicationMutation = mutationOptions({
    mutationFn: (data: CreateHsCaseApplication) =>
        apiClient.post("/api/applications/hs-case", { json: data }),
    onSuccess(_, __, ___, ctx) {
        invalidateApplications(ctx.client);
    },
});

export const updateApplicationStatusMutation = mutationOptions({
    mutationFn: ({ id, data }: { id: string; data: UpdateApplicationStatus }) =>
        apiClient.patch("/api/applications/{id}/status", {
            params: { id },
            json: data,
        }),
    onSuccess(_, __, ___, ctx) {
        invalidateApplications(ctx.client);
    },
});

export const regenerateApplicationPdfMutation = mutationOptions({
    mutationFn: ({ id }: { id: string }) =>
        apiClient.post("/api/applications/{id}/pdf/regenerate", {
            params: { id },
        }),
    onSuccess(_, __, ___, ctx) {
        invalidateApplications(ctx.client);
    },
});

/** Fetch an application's PDF and return a temporary object URL for it. */
export function fetchApplicationPdfUrl(id: string): Promise<string> {
    return fetchPrivateObjectUrl(`api/applications/${id}/pdf`);
}

/** Fetch one attachment and return a temporary object URL for it. */
export function fetchApplicationAttachmentUrl(
    id: string,
    assetKey: string,
): Promise<string> {
    return fetchPrivateObjectUrl(
        `api/applications/${id}/attachments/${assetKey}`,
    );
}

/**
 * Upload one attachment and return its asset key.
 *
 * Attachments are private: only the submitter and the handlers of that
 * application type may read them back, through the authorized attachment
 * route.
 */
export async function uploadApplicationAttachment(file: File): Promise<string> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("visibility", "private");

    const result = (await apiClient.post("/api/assets", {
        body: formData,
    } as never)) as { key: string };

    return result.key;
}
