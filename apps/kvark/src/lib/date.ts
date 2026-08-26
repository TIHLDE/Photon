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

/**
 * Cached `Intl` formatters, keyed on the options they were built with.
 *
 * Constructing an `Intl.DateTimeFormat` is the expensive part of formatting,
 * and the admin tables format one date per row. The cache keeps the helpers
 * below as cheap as a hand-rolled module-level formatter.
 */
const formatterCache = new Map<string, Intl.DateTimeFormat>();

function osloFormatter(
    options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
    const key = JSON.stringify(options);
    let formatter = formatterCache.get(key);
    if (!formatter) {
        formatter = new Intl.DateTimeFormat("nb-NO", {
            ...options,
            timeZone: OSLO_TIME_ZONE,
        });
        formatterCache.set(key, formatter);
    }
    return formatter;
}

/**
 * En dato i norsk tid, f.eks. `26. august 2026`.
 *
 * Bruk denne i stedet for `toLocaleDateString`, som formaterer i tidssonen til
 * den som kjører koden — UTC på SSR-serveren, Europe/Oslo i nettleseren.
 */
export function formatOsloDate(
    value: Date | string | number,
    options: Intl.DateTimeFormatOptions = {},
): string {
    return osloFormatter(options).format(new Date(value));
}

/**
 * Dato og klokkeslett i norsk tid, f.eks. `26.8.2026, 22:05:07`.
 *
 * Standardopsjonene er de `toLocaleString("nb-NO")` selv bruker, slik at
 * helperen skriver nøyaktig det kallstedene gjorde før.
 */
export function formatOsloDateTime(
    value: Date | string | number,
    options: Intl.DateTimeFormatOptions = {
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
    },
): string {
    return osloFormatter(options).format(new Date(value));
}
