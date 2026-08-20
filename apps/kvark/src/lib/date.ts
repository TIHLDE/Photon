import { addHours, startOfHour } from "date-fns";
import { nb } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";

/**
 * Neste hele time strengt etter `from` (f.eks. 14:23 -> 15:00, 15:00 -> 16:00).
 * Nyttig som standardverdi for starttidspunkt, som gjerne ligger på en hel time.
 */
export function nextWholeHour(from: Date = new Date()): Date {
    return startOfHour(addHours(from, 1));
}

/**
 * Alt TIHLDE gjør skjer i norsk tid, så alle tidspunkt vises i norsk tid.
 *
 * Dette er ikke bare kosmetikk: `format()` og `toLocaleString()` bruker
 * tidssonen til den som kjører koden. SSR-serveren står i UTC, nettleseren i
 * Europe/Oslo, så uten en fast sone rendres hvert klokkeslett to timer feil i
 * server-HTML-en og «hopper» ved hydrering — som React melder som en
 * hydreringsfeil (#418) på hver eneste side med et tidspunkt.
 */
export const OSLO_TIME_ZONE = "Europe/Oslo";

/** `Intl`-opsjoner for datoer som skrives ut med `toLocale*`. */
export const OSLO_DATE_OPTIONS = { timeZone: OSLO_TIME_ZONE } as const;

/**
 * `format()` fra date-fns, men alltid i norsk tid og med norsk locale.
 * Bruk denne i stedet for `format(new Date(iso), …)` for alt som skal vises.
 */
export function formatInOslo(
    value: Date | string | number,
    pattern: string,
): string {
    return formatInTimeZone(value, OSLO_TIME_ZONE, pattern, { locale: nb });
}

/**
 * Dagens dato i Norge, som lokal midnatt.
 *
 * `new Date()` som standardverdi i en datovelger gir feil dag på en server i
 * UTC de to første timene av det norske døgnet — og da står det én dato i
 * server-HTML-en og en annen i nettleseren. Her plukkes datoen ut i norsk tid
 * først, og settes så sammen igjen lokalt, slik at begge sider skriver samme
 * dag.
 */
export function todayInOslo(): Date {
    const [year, month, day] = formatInOslo(new Date(), "yyyy-MM-dd")
        .split("-")
        .map(Number) as [number, number, number];
    return new Date(year, month - 1, day);
}
