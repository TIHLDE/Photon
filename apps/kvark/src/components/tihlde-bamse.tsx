import { useQuery } from "@tanstack/react-query";

import { authQueryOptions } from "#/api/auth";

/** Den ene brukeren som får bamse ved siden av logoen. */
const BAMSE_USERNAMES = ["mayae", "ahevense", "siguraso"];

export function TihldeBamse({ className }: { className?: string }) {
    const { data: session } = useQuery(authQueryOptions);

    const username = session?.user?.username ?? "";

    if (!(username in BAMSE_USERNAMES)) {
        return null;
    }

    return <img src="/tihlde-bamse.webp" alt="" className={className} />;
}
