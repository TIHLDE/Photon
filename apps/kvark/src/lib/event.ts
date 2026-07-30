import { format, formatDistanceToNowStrict } from "date-fns";
import { nb } from "date-fns/locale";

// -- Shared display types (previously in mock/events) --

export type EventRegistrationState =
    | "not-open"
    | "open"
    | "joined"
    | "awaiting-payment"
    | "on-waitlist"
    | "closed"
    | "full"
    | "not-eligible";

export type EventDeadline = {
    day: string;
    time: string;
};

export type EventPrice = { kind: "free" } | { kind: "paid"; label: string };

export type EventRegistrant = {
    id: string;
    name: string;
    studyProgram?: string;
    classYear?: number;
    onWaitlist?: boolean;
    allowPhoto?: boolean;
};

type ApiRegistration = {
    status:
        | "registered"
        | "waitlisted"
        | "cancelled"
        | "attended"
        | "no_show"
        | "pending";
} | null;

/**
 * Derive the UI registration state from the API event's `registration`
 * (the authenticated user's own registration), whether registration is
 * closed, and when it opens.
 *
 * `registrationStart` matters even though the API rejects an early sign-up:
 * without it the card showed an inviting "Meld deg på" for events whose
 * registration had not opened yet. Null means "open immediately".
 */
export function deriveRegistrationState(
    registration: ApiRegistration,
    closed: boolean,
    registrationStart?: string | null,
    now: Date = new Date(),
): EventRegistrationState {
    switch (registration?.status) {
        case "registered":
        case "attended":
            return "joined";
        case "waitlisted":
            return "on-waitlist";
        case "pending":
            return "awaiting-payment";
        default:
            if (closed) return "closed";
            if (registrationStart && new Date(registrationStart) > now) {
                return "not-open";
            }
            return "open";
    }
}

/**
 * Build a price label from the API event's paid-event fields.
 * `priceMinor` is stored in minor units (øre).
 */
export function formatEventPrice(
    isPaidEvent: boolean,
    priceMinor: number | null | undefined,
): EventPrice {
    if (!isPaidEvent || !priceMinor) {
        return { kind: "free" };
    }
    return { kind: "paid", label: `kr ${Math.round(priceMinor / 100)}` };
}

/**
 * Format an ISO timestamp as a Norwegian long date, e.g. "tor. 30. apr. 2026".
 */
export function formatEventDate(iso: string): string {
    return format(new Date(iso), "EEE d. MMM yyyy", { locale: nb });
}

/**
 * Format an ISO timestamp as a time of day, e.g. "12:00".
 */
export function formatEventTime(iso: string): string {
    return format(new Date(iso), "HH:mm", { locale: nb });
}

/**
 * Split an ISO timestamp into the `{ day, time }` shape the registration
 * card's timeline renders.
 */
export function toEventDeadline(iso: string): EventDeadline {
    return { day: formatEventDate(iso), time: formatEventTime(iso) };
}

/**
 * "2 dager", "3 timer" — the tail of "Påmelding åpner om …".
 */
export function formatTimeUntil(iso: string): string {
    return formatDistanceToNowStrict(new Date(iso), { locale: nb });
}

/**
 * Combined date + time label for cards, e.g. "tor. 30. apr. 2026, 12:00".
 */
export function formatEventDateTime(iso: string): string {
    return `${formatEventDate(iso)}, ${formatEventTime(iso)}`;
}
