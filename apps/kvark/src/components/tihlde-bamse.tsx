import { useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { authQueryOptions, getAuthSession } from "#/api/auth";

/** Lista over hvem som får bamse er personopplysninger, og holdes på serveren. */
const getShowsBamse = createServerFn().handler(async () => {
    const session = await getAuthSession();
    const username = session?.user?.username;
    if (!username) return false;

    const usernames = process.env.BAMSE_USERNAMES?.split(",") ?? [];
    return usernames.map((name) => name.trim()).includes(username);
});

export function TihldeBamse({ className }: { className?: string }) {
    const { data: session } = useQuery(authQueryOptions);
    const username = session?.user?.username;

    const { data: showsBamse } = useQuery({
        queryKey: ["bamse", username],
        queryFn: () => getShowsBamse(),
        enabled: Boolean(username),
        staleTime: Number.POSITIVE_INFINITY,
        retry: false,
    });

    if (!showsBamse) {
        return null;
    }

    return <img src="/tihlde-bamse.webp" alt="" className={className} />;
}
