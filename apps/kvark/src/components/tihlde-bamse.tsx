import { useQuery } from "@tanstack/react-query";

import { authQueryOptions } from "#/api/auth";

/** Brukerne som får bamse ved siden av logoen. */
const BAMSE_USERNAMES = (import.meta.env.VITE_BAMSE_USERNAMES ?? "")
    .split(",")
    .map((username) => username.trim())
    .filter(Boolean);

export function TihldeBamse({ className }: { className?: string }) {
    const { data: session } = useQuery(authQueryOptions);

    const username = session?.user?.username ?? "";

    if (!BAMSE_USERNAMES.includes(username)) {
        return null;
    }

    return <img src="/tihlde-bamse.webp" alt="" className={className} />;
}
