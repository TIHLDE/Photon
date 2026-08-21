import { addMilliseconds, formatDistanceStrict, set } from "date-fns";
import { nb } from "date-fns/locale";
import { MAX_CLASS_YEAR, computeClassYear } from "@photon/auth/academic-year";
import { formatInOslo } from "#/lib/date";

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
    /** Whether the spot is already paid for. Always false on free events. */
    hasPaid?: boolean;
} | null;

type RegistrationStateInput = {
    /** The authenticated user's own registration, if any. */
    registration: ApiRegistration;
    /** The event's own `closed` flag. */
    closed: boolean;
    /** Whether the event has sign-up at all. */
    requiresSigningUp: boolean;
    /** Whether the event costs money — an unpaid spot then awaits payment. */
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
        // En plass på et betalt arrangement er reservert, ikke sikret, før
        // den er betalt: det er her betalingsknappen hører hjemme. Uten dette
        // fikk medlemmet «Du har plass på arrangementet!» og ingen måte å
        // betale på — plassen ble så tatt tilbake da fristen gikk ut.
        case "registered":
            return isPaidEvent && !registration.hasPaid
                ? "awaiting-payment"
                : "joined";
        // Møtt opp betyr at arrangementet er i gang. Da er betalingen et
        // oppgjør mellom medlemmet og arrangøren, ikke en knapp på nettsida.
        case "attended":
            return "joined";
        case "waitlisted":
            return "on-waitlist";
        // Påmeldingen ligger som «pending» til serveren har avgjort om det ble
        // plass eller venteliste. Betalingen hører til plassen, og API-et
        // avviser et betalingsforsøk før den er avgjort — derfor «behandler»
        // også på betalte arrangementer. Ellers blinket Vipps-knappen forbi i
        // et sekund før medlemmet havnet på venteliste.
        case "pending":
            return "processing";
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
    // Klokka på serveren er fasit. Treffer du denne, gikk du enten et sekund
    // for tidlig eller har en klokke som ligger foran.
    if (message.includes("Registration has not opened yet")) {
        return "Påmeldingen har ikke åpnet ennå. Vent til klokkeslettet over og prøv igjen.";
    }
    if (message.includes("Registration has closed")) {
        return "Påmeldingsfristen har gått ut.";
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
    // Betalingsfeilene under kommer fra samme kort: knappen «Betal med Vipps»
    // ligger i påmeldingskortet, og feilen vises på samme sted.
    if (message.includes("pending payment already exists")) {
        return "Du har allerede en betaling på gang i Vipps. Fullfør den der, eller vent et minutt og prøv igjen.";
    }
    if (message.includes("already paid")) {
        return "Plassen er allerede betalt. Last siden på nytt.";
    }
    if (message.includes("register for the event before paying")) {
        return "Du må ha en plass på arrangementet før du kan betale.";
    }
    if (message.includes("does not require payment")) {
        return "Dette arrangementet krever ingen betaling.";
    }
    if (message.includes("Failed to initiate Vipps payment")) {
        return "Vipps svarte ikke. Prøv igjen om litt — plassen din står så lenge fristen ikke har gått ut.";
    }

    return message;
}

/**
 * Facebook-gruppa der medlemmer kjøper og selger billetter til betalte
 * arrangementer. Samme gruppe som den gamle nettsida lenket til, så alle som
 * allerede er medlem der finner igjen det de er vant til.
 */
export const TICKET_RESALE_GROUP_URL =
    "https://www.facebook.com/groups/598608738731749/";

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
    return formatInOslo(iso, "EEE d. MMM yyyy");
}

/**
 * Format an ISO timestamp as a time of day, e.g. "12:00".
 */
export function formatEventTime(iso: string): string {
    return formatInOslo(iso, "HH:mm");
}

/**
 * Split an ISO timestamp into the `{ day, time }` shape the registration
 * card's timeline renders.
 */
export function toEventDeadline(iso: string): EventDeadline {
    return { day: formatEventDate(iso), time: formatEventTime(iso) };
}

/**
 * "2 dager", "3 timer", "34 sekunder" — the tail of "Påmelding åpner om …".
 *
 * `now` kommer utenfra fordi teksten teller ned: siden mater inn en klokke som
 * tikker (`useNow`), og da må avstanden regnes fra samme klokke som avgjør om
 * påmeldingen har åpnet.
 */
export function formatTimeUntil(iso: string, now: Date = new Date()): string {
    return formatDistanceStrict(new Date(iso), now, { locale: nb });
}

/**
 * "9:32", "0:14" — tida igjen på en frist som løper mens medlemmet ser på.
 *
 * `formatTimeUntil` runder til nærmeste enhet, så «2 minutter» blir stående i
 * et helt minutt. Det duger til påmeldinger som åpner om dager, men en
 * betalingsfrist på et kvarter må synlig løpe: sekundene er hele poenget med
 * at den teller ned. Over en time faller vi tilbake på den grove teksten —
 * «58:12» sier mindre enn «en time».
 *
 * Returnerer `null` når fristen er passert.
 */
export function formatCountdown(
    iso: string,
    now: Date = new Date(),
): string | null {
    const remainingMs = new Date(iso).getTime() - now.getTime();
    if (Number.isNaN(remainingMs) || remainingMs <= 0) return null;
    if (remainingMs >= 60 * 60 * 1000) return formatTimeUntil(iso, now);

    // Rundes opp: med 200 ms igjen står det «0:01» og ikke «0:00», som ville
    // sagt at fristen var ute mens den fortsatt løp.
    const totalSeconds = Math.ceil(remainingMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Combined date + time label for cards, e.g. "tor. 30. apr. 2026, 12:00".
 */
export function formatEventDateTime(iso: string): string {
    return `${formatEventDate(iso)}, ${formatEventTime(iso)}`;
}

/** Reservevarighet når vi ikke kan utlede hvor langt arrangementet var. */
const FALLBACK_EVENT_DURATION_MS = 2 * 60 * 60 * 1000;

/**
 * Sluttidspunktet som hører til et nytt starttidspunkt.
 *
 * Flytter man starten forbi slutten, blir arrangementet negativt langt. I
 * stedet for å la admin rydde opp manuelt drar vi slutten med: den beholder
 * klokkeslettet sitt og flyttes til samme dato som starten. Er den fortsatt
 * for tidlig — start 22:00, slutt 09:00 — legger vi den opprinnelige
 * varigheten til starten i stedet.
 *
 * Returnerer `end` uendret når den allerede ligger etter starten.
 */
export function alignEventEnd(
    start: Date,
    end: Date | null,
    previousStart: Date | null,
): Date | null {
    if (!end || end > start) return end;

    const sameDay = set(start, {
        hours: end.getHours(),
        minutes: end.getMinutes(),
        seconds: 0,
        milliseconds: 0,
    });
    if (sameDay > start) return sameDay;

    const previousDuration =
        previousStart && end > previousStart
            ? end.getTime() - previousStart.getTime()
            : FALLBACK_EVENT_DURATION_MS;

    return addMilliseconds(start, previousDuration);
}

/**
 * Meldingene arrangementsskjemaet viser når det ikke kan lagres.
 *
 * Vaktene i «Publiser» og «Lagre endringer» returnerte tidligere uten å si
 * fra, så knappene så ut til å ikke gjøre noe i det hele tatt — verst på et
 * nytt arrangement, der påmeldingen er på som standard. Meldingene ligger her
 * fordi begge skjemaene håndhever de samme reglene.
 *
 * Påmeldingsstart står bevisst ikke på lista: API-et tar imot `null` og lar
 * påmeldingen åpne med én gang.
 */
export const EVENT_FORM_ERRORS = {
    missingTime: "Arrangementet mangler start- eller sluttidspunkt.",
    missingCategory: "Velg en kategori for arrangementet.",
    missingRegistrationEnd:
        "Arrangementer med påmelding må ha en påmeldingsfrist.",
    registrationOrder: "Påmeldingen må åpne før påmeldingsfristen.",
} as const;

/**
 * En prioritert gruppe slik arrangementet leverer den.
 *
 * Samme form som `priorityPools` i `GET /events/:id`: maks én gruppe og maks
 * ett klassetrinn, som må stemme samtidig.
 */
export type EventPriorityPool = {
    classYear: number | null;
    group: { name: string; slug: string } | null;
};

/** En kull-gruppe har opptaksåret både som slug og som navn, f.eks. «2023». */
const COHORT_SLUG = /^\d{4}$/;

/**
 * Navnet et medlem skal se på én prioritert gruppe.
 *
 * Etikettene speiler valgene i `PriorityPoolEditor`, så arrangøren kjenner
 * igjen det hen valgte: «Dataingeniør», «1. klasse», «Digital transformasjon
 * 4. klasse». Kull-grupper fra det gamle systemet regnes om til klassetrinn —
 * «2023» sier ingenting om hvem som er prioritert i år.
 */
export function priorityPoolLabel(
    pool: EventPriorityPool,
    now = new Date(),
): string | null {
    if (pool.group && COHORT_SLUG.test(pool.group.slug)) {
        const classYear = computeClassYear(
            Number.parseInt(pool.group.slug, 10),
            now,
        );
        return classYear >= 1 && classYear <= MAX_CLASS_YEAR
            ? `${classYear}. klasse`
            : null;
    }

    if (pool.group) {
        return pool.classYear
            ? `${pool.group.name} ${pool.classYear}. klasse`
            : pool.group.name;
    }

    return pool.classYear ? `${pool.classYear}. klasse` : null;
}

/**
 * Etikettene for alle de prioriterte gruppene, i lesbar rekkefølge.
 *
 * Klassetrinnene først og stigende, så gruppene alfabetisk — rekkefølgen i
 * databasen er den arrangøren tilfeldigvis la dem inn i. Pooler uten kriterier
 * (eller med et utgått kull) faller bort, og duplikater slås sammen: to pooler
 * som leses likt er én opplysning for medlemmet.
 */
export function priorityPoolLabels(
    pools: readonly EventPriorityPool[],
    now = new Date(),
): string[] {
    const bare: string[] = [];
    const named: string[] = [];

    for (const pool of pools) {
        const label = priorityPoolLabel(pool, now);
        if (!label) continue;
        if (pool.group && !COHORT_SLUG.test(pool.group.slug)) named.push(label);
        else bare.push(label);
    }

    return [
        ...new Set([
            ...bare.sort((a, b) => a.localeCompare(b, "nb")),
            ...named.sort((a, b) => a.localeCompare(b, "nb")),
        ]),
    ];
}
