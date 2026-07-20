import { mutationOptions } from "@tanstack/react-query";
import { apiClient } from "#/api/api-client";
import type { CompanyContact } from "@tihlde/sdk";

export const sendCompanyContactMutation = mutationOptions({
    mutationFn: ({ data }: { data: CompanyContact }) =>
        apiClient.post("/api/company/contact", {
            json: data,
        }),
});
