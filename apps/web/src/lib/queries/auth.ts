import { queryOptions } from "@tanstack/react-query";
import { authClient } from "~/lib/auth";

export const authKeys = {
    all: ["auth"] as const,
    session: () => [...authKeys.all, "session"] as const,
};

export const getSessionQuery = () =>
    queryOptions({
        queryKey: authKeys.session(),
        queryFn: () => authClient.getSession(),
        staleTime: 5 * 60 * 1000,
    });
