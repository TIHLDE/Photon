/**
 * Minimal iCalendar-generator (RFC 5545) for kalender-abonnement.
 *
 * Vi skriver formatet for hånd i stedet for å dra inn et bibliotek: en
 * VCALENDAR med VEVENT-er er noen få titalls linjer, og reglene som faktisk
 * betyr noe — escaping, folding på 75 oktetter og CRLF — er samlet her.
 */

export type ICalEvent = {
    /** Global, stabil ID. Samme arrangement må gi samme UID hver gang. */
    uid: string;
    start: Date;
    end: Date;
    /** Når raden sist ble endret, brukes som DTSTAMP/LAST-MODIFIED. */
    updatedAt?: Date;
    summary: string;
    description?: string | null;
    location?: string | null;
    url?: string | null;
    status?: "CONFIRMED" | "TENTATIVE" | "CANCELLED";
};

export type ICalCalendar = {
    /** Navnet kalenderklienter viser på abonnementet. */
    name: string;
    /** Domenet UID-ene hører hjemme i, f.eks. "tihlde.org". */
    productId: string;
    events: ICalEvent[];
};

/** Tekstverdier: `\`, `;`, `,` og linjeskift må escapes (RFC 5545 §3.3.11). */
function escapeText(value: string): string {
    return value
        .replace(/\\/g, "\\\\")
        .replace(/;/g, "\\;")
        .replace(/,/g, "\\,")
        .replace(/\r\n|\n|\r/g, "\\n");
}

/** UTC-form: 20260815T170000Z. */
function formatDate(date: Date): string {
    return `${date.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

/**
 * Ingen linje kan være lengre enn 75 oktetter. Lengre linjer brytes med
 * CRLF + ett mellomrom. Vi teller i oktetter, ikke tegn, så «ø» og emoji
 * ikke sniker seg over grensa.
 */
function foldLine(line: string): string {
    const encoder = new TextEncoder();
    if (encoder.encode(line).length <= 75) return line;

    const parts: string[] = [];
    let current = "";
    let currentBytes = 0;
    // Fortsettelseslinjer starter med et mellomrom, som også teller.
    let limit = 75;

    for (const char of line) {
        const size = encoder.encode(char).length;
        if (currentBytes + size > limit) {
            parts.push(current);
            current = "";
            currentBytes = 0;
            limit = 74;
        }
        current += char;
        currentBytes += size;
    }
    parts.push(current);

    return parts.join("\r\n ");
}

export function buildICalendar(calendar: ICalCalendar): string {
    const lines: string[] = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        `PRODID:-//${calendar.productId}//Photon//NO`,
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        `X-WR-CALNAME:${escapeText(calendar.name)}`,
        "X-WR-TIMEZONE:Europe/Oslo",
        // Et hint til klienten om hvor ofte den bør hente på nytt. Mange
        // ignorerer det, men de som følger det oppdaterer hver time i
        // stedet for én gang i døgnet.
        "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
        "X-PUBLISHED-TTL:PT1H",
    ];

    for (const event of calendar.events) {
        lines.push(
            "BEGIN:VEVENT",
            `UID:${event.uid}`,
            `DTSTAMP:${formatDate(event.updatedAt ?? new Date())}`,
            `DTSTART:${formatDate(event.start)}`,
            `DTEND:${formatDate(event.end)}`,
            `SUMMARY:${escapeText(event.summary)}`,
        );

        if (event.description) {
            lines.push(`DESCRIPTION:${escapeText(event.description)}`);
        }
        if (event.location) {
            lines.push(`LOCATION:${escapeText(event.location)}`);
        }
        if (event.url) {
            lines.push(`URL:${escapeText(event.url)}`);
        }
        if (event.status) {
            lines.push(`STATUS:${event.status}`);
        }
        if (event.updatedAt) {
            lines.push(`LAST-MODIFIED:${formatDate(event.updatedAt)}`);
        }

        lines.push("END:VEVENT");
    }

    lines.push("END:VCALENDAR");

    return `${lines.map(foldLine).join("\r\n")}\r\n`;
}
