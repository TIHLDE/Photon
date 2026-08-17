import { format, formatDistanceToNowStrict } from "date-fns";
import { nb } from "date-fns/locale";

// -- Shared display types (previously in mock/events) --

export type EventRegistrationState =
    | "no-signup"
    | "not-open"
    | "open"
    | "processing"
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
    /** Whether the event has sign-up at all. */
    requiresSigningUp: boolean;
    /** Whether the event costs money — a pending registration then awaits payment. */
    isPaidEvent: boolean;
    /** When registration opens. Null means "open immediately". */
    registrationStart?: string | null;
    /** Påmeldingsfristen. Null means "no deadline". */
    registrationEnd?: string | null;
    /** When the event itself ends. */
    endTime?: string | null;
    /** Maksgrensen for antall plasser. Null means "no limit". */
    capacity?: number | null;
    /** How many already hold a spot — compared against `capacity`. */
    registeredCount?: number;
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
        requiresSigningUp,
        isPaidEvent,
        registrationStart,
        registrationEnd,
        endTime,
        capacity,
        registeredCount,
    }: RegistrationStateInput,
    now: Date = new Date(),
): EventRegistrationState {
    // Arrangementer uten påmelding har ingenting å melde seg på. Uten dette
    // sto det en helt vanlig «Meld deg på»-knapp der, og API-et svarte 409.
    if (!requiresSigningUp) return "no-signup";

    switch (registration?.status) {
        case "registered":
        case "attended":
            return "joined";
        case "waitlisted":
            return "on-waitlist";
        // Påmeldingen ligger som «pending» til cron-en har avgjort om den ble
        // plass eller venteliste. På et gratis arrangement er det bare noen
        // sekunders behandling — «venter på betaling» ville vært feil.
        case "pending":
            return isPaidEvent ? "awaiting-payment" : "processing";
        default:
            if (closed) return "closed";
            if (endTime && new Date(endTime) < now) return "closed";
            if (registrationEnd && new Date(registrationEnd) < now) {
                return "closed";
            }
            if (registrationStart && new Date(registrationStart) > now) {
                return "not-open";
            }
            // Sist av alle grensene: at plassene er tatt betyr ingenting så
            // lenge påmeldingen er stengt eller ikke åpnet ennå — da er det
            // det som skal stå. Uten dette sto det «Meld deg på» på et fullt
            // arrangement, og medlemmet oppdaget først etterpå at de havnet
            // på venteliste.
            if (capacity != null && (registeredCount ?? 0) >= capacity) {
                return "full";
            }
            return "open";
    }
}

/**
 * Hvor lenge vi venter før vi spør igjen om en påmelding som står som
 * «pending», gitt hvor lenge den har stått slik.
 *
 * Serveren avgjør plassen med én gang påmeldingen er lagret, så svaret ligger
 * som regel klart et titalls millisekunder etter at knappen ga fra seg
 * kontrollen. Første spørring kommer derfor raskt. Blir den likevel stående —
 * et fullt arrangement med lang venteliste tar lengre tid å avgjøre — trapper
 * vi ned, så en treg avklaring ikke blir til titalls spørringer i minuttet fra
 * hver eneste som venter.
 */
export function registrationPollInterval(pendingForMs: number): number {
    if (pendingForMs < 3_000) return 300;
    if (pendingForMs < 15_000) return 1_000;
    return 3_000;
}

/**
 * Oversett en feil fra påmeldings-endepunktet til noe et medlem forstår.
 *
 * API-meldingene er engelske og skrevet for utviklere. De vanligste årsakene
 * får en norsk forklaring; resten faller tilbake på API-meldingen, som fortsatt
 * er langt bedre enn ingenting.
 */
export function registrationErrorMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes("not open for registration")) {
        return "Dette arrangementet er ikke åpent for påmelding.";
    }
    if (message.includes("already registered")) {
        return "Du er allerede påmeldt. Last siden på nytt for å se påmeldingen din.";
    }
    if (message.includes("accept the event rules")) {
        return "Du må godkjenne arrangementsreglene før du kan melde deg på. Huk av i varselet over.";
    }
    if (message.includes("priority pool")) {
        return "Dette arrangementet er forbeholdt medlemmer i en prioritert gruppe.";
    }
    if (message.includes("only open to students at")) {
        const institute = message.split("only open to students at")[1]?.trim();
        return institute
            ? `Dette arrangementet er kun for studenter ved ${institute}.`
            : "Dette arrangementet er kun for studenter ved ett bestemt institutt.";
    }
    if (message.includes("requires permission")) {
        return "Kontoen din har ikke tilgang til å melde seg på arrangementer. Ta kontakt med Index hvis dette ser feil ut.";
    }
    if (message.includes("Authentication required")) {
        return "Du må være innlogget for å melde deg på.";
    }
    if (message.includes("not registered")) {
        return "Du er ikke påmeldt dette arrangementet.";
    }

    return message;
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
