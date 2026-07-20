import { format, formatDistanceToNow } from "date-fns";
import { nb } from "date-fns/locale";

// -- Shared display types (previously in mock/news) --

export type NewsItem = {
    id: string;
    title: string;
    excerpt: string;
    imageUrl?: string;
    body: string;
    createdAt: string;
    updatedAt: string;
};

/**
 * Format an ISO timestamp as a Norwegian absolute date + time,
 * e.g. "tor. 24. apr. 2026, 14:30".
 */
export function formatNewsDate(iso: string): string {
    return format(new Date(iso), "EEE d. MMM yyyy, HH:mm", { locale: nb });
}

/**
 * Format an ISO timestamp as a Norwegian relative distance,
 * e.g. "3 dager siden".
 */
export function formatNewsDateRelative(iso: string): string {
    return formatDistanceToNow(new Date(iso), { locale: nb, addSuffix: true });
}

/**
 * Whether the news item has been meaningfully updated after creation.
 */
export function wasNewsUpdated(createdAt: string, updatedAt: string): boolean {
    return new Date(updatedAt).getTime() - new Date(createdAt).getTime() > 1000;
}
