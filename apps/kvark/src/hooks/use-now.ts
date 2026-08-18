import { useEffect, useState } from "react";

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

/**
 * En klokke som tikker fram til `until`, og står stille etterpå.
 *
 * Alt som telles ned mot et tidspunkt — «Påmelding åpner om 34 sekunder» —
 * regnes ut fra «nå». Uten en klokke som tikker ble «nå» stående på det
 * tidspunktet siden ble lastet, så tallet sto stille og påmeldingen åpnet
 * først når medlemmet lastet siden på nytt.
 *
 * Frekvensen følger avstanden: siste timen tikker den hvert sekund, ellers
 * hvert minutt. Siste tikket legges eksakt på `until`, så tilstanden skifter i
 * samme øyeblikk som påmeldingen åpner.
 */
export function useNow(until?: string | null): Date {
    const [now, setNow] = useState(() => new Date());
    const target = until ? new Date(until).getTime() : null;

    useEffect(() => {
        if (target === null || Number.isNaN(target)) return;

        let timeout: ReturnType<typeof setTimeout> | undefined;

        const schedule = () => {
            const remaining = target - Date.now();
            if (remaining <= 0) return;

            const step = remaining > HOUR ? MINUTE : SECOND;
            // Den lille marginen sørger for at klokka faktisk har passert
            // `target` når vi våkner — timere fyrer gjerne et hår for tidlig,
            // og da ville påmeldingen stått som «ikke åpnet» ett tikk til.
            timeout = setTimeout(
                () => {
                    setNow(new Date());
                    schedule();
                },
                Math.min(step, remaining + 50),
            );
        };

        schedule();
        return () => clearTimeout(timeout);
    }, [target]);

    return now;
}
