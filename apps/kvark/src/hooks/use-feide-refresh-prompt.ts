import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { authQueryOptions } from "#/api/auth";

const STORAGE_PREFIX = "feide-refresh-dismissed:";

export function useFeideRefreshPrompt(eventId: string, hasPriority: boolean) {
    const { data: session } = useQuery(authQueryOptions);
    const needsRefresh = session?.user.needsFeideRefresh === true;

    // Skjult til etter mount: localStorage finnes ikke under SSR, og å gjette
    // gir en hydreringsfeil.
    const [isDismissed, setIsDismissed] = useState(true);

    useEffect(() => {
        setIsDismissed(
            window.localStorage.getItem(STORAGE_PREFIX + eventId) === "true",
        );
    }, [eventId]);

    return {
        showFeideRefreshPrompt: needsRefresh && hasPriority && !isDismissed,
        dismissFeideRefreshPrompt() {
            window.localStorage.setItem(STORAGE_PREFIX + eventId, "true");
            setIsDismissed(true);
        },
    };
}
