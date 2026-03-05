import { queryOptions } from "@tanstack/react-query";
import { photon } from "~/lib/api";

export const formKeys = {
    all: ["forms"] as const,
    lists: () => [...formKeys.all, "list"] as const,
    details: () => [...formKeys.all, "detail"] as const,
    detail: (id: string) => [...formKeys.details(), id] as const,
    statistics: (id: string) =>
        [...formKeys.detail(id), "statistics"] as const,
    submissions: (formId: string) =>
        [...formKeys.detail(formId), "submissions"] as const,
};

export const listFormsQuery = () =>
    queryOptions({
        queryKey: formKeys.lists(),
        queryFn: () => photon.GET("/api/forms").then((r) => r.data),
    });

export const getFormQuery = (id: string) =>
    queryOptions({
        queryKey: formKeys.detail(id),
        queryFn: () =>
            photon
                .GET("/api/forms/{id}", { params: { path: { id } } })
                .then((r) => r.data),
    });

export const getFormStatisticsQuery = (id: string) =>
    queryOptions({
        queryKey: formKeys.statistics(id),
        queryFn: () =>
            photon
                .GET("/api/forms/{id}/statistics", {
                    params: { path: { id } },
                })
                .then((r) => r.data),
    });

export const listFormSubmissionsQuery = (formId: string) =>
    queryOptions({
        queryKey: formKeys.submissions(formId),
        queryFn: () =>
            photon
                .GET("/api/forms/{formId}/submissions", {
                    params: { path: { formId } },
                })
                .then((r) => r.data),
    });
