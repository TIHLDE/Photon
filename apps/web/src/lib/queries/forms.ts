import { queryOptions } from "@tanstack/react-query";
import { photon } from "~/lib/api";

export const formKeys = {
    all: ["forms"] as const,
    lists: () => [...formKeys.all, "list"] as const,
    details: () => [...formKeys.all, "detail"] as const,
    detail: (id: string) => [...formKeys.details(), id] as const,
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
