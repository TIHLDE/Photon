import { queryOptions } from "@tanstack/react-query";
import { photon } from "~/lib/api";

export const userKeys = {
    all: ["users"] as const,
    settings: () => [...userKeys.all, "settings"] as const,
    allergies: () => [...userKeys.all, "allergies"] as const,
};

export const getUserSettingsQuery = () =>
    queryOptions({
        queryKey: userKeys.settings(),
        queryFn: () => photon.GET("/api/user/me/settings").then((r) => r.data),
    });

export const listAllergiesQuery = () =>
    queryOptions({
        queryKey: userKeys.allergies(),
        queryFn: () => photon.GET("/api/user/allergy").then((r) => r.data),
    });
