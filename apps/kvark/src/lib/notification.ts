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
