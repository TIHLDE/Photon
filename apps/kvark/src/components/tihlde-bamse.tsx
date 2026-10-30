import { useQuery } from "@tanstack/react-query";

import { authQueryOptions } from "#/api/auth";

/** Brukerne som får bamse ved siden av logoen. */
const BAMSE_USERNAMES = ["mayae", "ahevense", "siguraso", "martigod"];

export function TihldeBamse({ className }: { className?: string }) {
    const { data: session } = useQuery(authQueryOptions);

    const username = session?.user?.username ?? "";

    if (!BAMSE_USERNAMES.includes(username)) {
        return null;
    }

    return <img src="/tihlde-bamse.webp" alt="" className={className} />;
}
