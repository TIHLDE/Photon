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

type RegistrationStateInput = {
    /** The authenticated user's own registration, if any. */
    registration: ApiRegistration;
    /** The event's own `closed` flag. */
    closed: boolean;
    /** When registration opens. Null means "open immediately". */
    registrationStart?: string | null;
    /** Påmeldingsfristen. Null means "no deadline". */
    registrationEnd?: string | null;
    /** When the event itself ends. */
    endTime?: string | null;
};

/**
 * Derive the UI registration state from the authenticated user's own
 * registration and the event's registration window.
 *
 * Every bound matters even though the API rejects a sign-up outside the
 * window: without them the card showed an inviting "Meld deg på" both before
 * registration opened and — for `registrationEnd`/`endTime` — long after the
 * event was over, since `closed` is a manual flag arrangørene sjelden setter.
 */
export function deriveRegistrationState(
    {
        registration,
        closed,
        registrationStart,
        registrationEnd,
        endTime,
    }: RegistrationStateInput,
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
            if (endTime && new Date(endTime) < now) return "closed";
            if (registrationEnd && new Date(registrationEnd) < now) {
                return "closed";
            }
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
