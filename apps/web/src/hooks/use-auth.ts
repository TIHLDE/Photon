import { useSuspenseQuery } from "@tanstack/react-query";
import { getSessionQuery } from "~/lib/queries/auth";

export function useOptionalAuth() {
    const { data } = useSuspenseQuery(getSessionQuery());
    return data.data;
}
