import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { authQueryOptions } from "#/api/auth";

const STORAGE_PREFIX = "allergy-prompt-dismissed:";

/**
 * Om medlemmet skal oppfordres til å oppgi allergier på dette arrangementet.
 *
 * To krav må være oppfylt. De må ha betalt og fått plassen sin — da er de
 * ferdige med påmeldingen, og spørsmålet forstyrrer ingenting. Og de må aldri
 * ha svart: har de svart «ingen allergier», er de ferdige med spørsmålet og
 * skal ikke få det igjen.
 *
 * Betalingen er også det nærmeste vi kommer «her blir det mat». Det finnes
 * ingen serveringsflagg på arrangementer, og de betalte er dem arrangøren
 * faktisk bestiller mat til.
 *
 * Avvisningen huskes per arrangement i `localStorage`, ikke i databasen: å
 * ikke orke akkurat nå er ikke et svar, og det skal ikke se ut som ett for
 * arrangøren.
 */
export function useAllergyPrompt(eventId: string, hasPaid: boolean) {
    const { data: session } = useQuery(authQueryOptions);
    const hasAnswered = session?.user.settings?.allergiesConfirmedAt != null;

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
        showAllergyPrompt:
            Boolean(session) && hasPaid && !hasAnswered && !isDismissed,
        dismissAllergyPrompt() {
            window.localStorage.setItem(STORAGE_PREFIX + eventId, "true");
            setIsDismissed(true);
        },
    };
}
