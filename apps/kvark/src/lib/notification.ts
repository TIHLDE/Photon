import { formatDistanceToNow } from "date-fns";
import { nb } from "date-fns/locale";

/**
 * Format an ISO timestamp as a Norwegian relative distance,
 * e.g. "3 timer siden".
 */
export function formatNotificationTime(iso: string): string {
    return formatDistanceToNow(new Date(iso), { locale: nb, addSuffix: true });
}

/**
 * Varsler lagres med to slags lenker: absolutte URL-er bygget av `ROOT_URL`
 * (arrangementer) og rene stier (bøter). Absolutte lenker til vårt eget domene
 * gjøres om til stier, ellers ville et klikk lastet hele appen på nytt.
 */
export function notificationHref(link: string | null): string | undefined {
    if (!link) return undefined;
    if (!/^https?:\/\//i.test(link)) return link;

    try {
        const url = new URL(link);
        if (
            typeof window !== "undefined" &&
            url.origin === window.location.origin
        ) {
            return `${url.pathname}${url.search}${url.hash}`;
        }
        return link;
    } catch {
        // En ugyldig URL er ikke verdt å krasje varsellisten for.
        return link;
    }
}

/** Om lenken peker ut av appen og derfor bør åpnes i ny fane. */
export function isExternalNotificationHref(href: string | undefined): boolean {
    return href !== undefined && /^https?:\/\//i.test(href);
}

/**
 * TanStack Router-ens `to` tar bare en sti: en spørring i den blir en del av
 * stien, så `/grupper/x?tab=boter` landet på feil fane. Del lenken opp i
 * stien og søkeparameterne den skal navigere med.
 */
export function splitInternalHref(href: string): {
    pathname: string;
    search: Record<string, string>;
    hash: string | undefined;
} {
    const url = new URL(href, "http://kvark.invalid");
    return {
        pathname: url.pathname,
        search: Object.fromEntries(url.searchParams),
        hash: url.hash ? url.hash.slice(1) : undefined,
    };
}
