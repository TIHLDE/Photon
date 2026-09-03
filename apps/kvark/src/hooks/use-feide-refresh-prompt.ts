import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { authQueryOptions } from "#/api/auth";

const STORAGE_PREFIX = "feide-refresh-dismissed:";

/**
 * Om medlemmet skal bes om å logge inn med Feide på nytt.
 *
 * `needsFeideRefresh` kommer fra sesjonen og er sann når Feide sist svarte for
 * mer enn 120 dager siden — lenger enn et semester, så innskrivningen kan ha
 * endret seg uten at vi vet det. Backend setter den bare for medlemmer som
 * faktisk har en Feide-konto: den som ikke har det, har ingenting å logge inn
 * med, og studiet de bærer er det beste vi noen gang får for dem.
 *
 * Vises bare der studiet betyr noe — på et arrangement med prioritering. Ellers
 * er det en påminnelse uten konsekvens, og de blir det lett å ignorere.
 *
 * Avvisningen huskes per arrangement i `localStorage`, samme som allergi-
 * oppfordringen: å ikke orke akkurat nå er ikke et svar, og en avvisning skal
 * ikke se ut som en bekreftelse.
 */
export function useFeideRefreshPrompt(eventId: string, hasPriority: boolean) {
    const { data: session } = useQuery(authQueryOptions);
    const needsRefresh = session?.user.needsFeideRefresh === true;

    // Starter skjult og slås på etter mount. `localStorage` finnes ikke under
    // SSR, og å gjette på serveren gir en hydreringsfeil i stedet for et
    // varsel.
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
