import { describe, expect, it } from "vitest";
import { buildICalendar } from "~/lib/event/ical";

const baseEvent = {
    uid: "abc@tihlde.org",
    start: new Date("2026-08-20T17:00:00.000Z"),
    end: new Date("2026-08-20T19:00:00.000Z"),
    summary: "Bedpres",
};

describe("buildICalendar", () => {
    it("wraps the events in a VCALENDAR with CRLF line endings", () => {
        const ics = buildICalendar({
            name: "TIHLDE",
            productId: "tihlde.org",
            events: [baseEvent],
        });

        expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
        expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
        expect(ics).toContain("DTSTART:20260820T170000Z");
        expect(ics).toContain("DTEND:20260820T190000Z");
        expect(ics).toContain("UID:abc@tihlde.org");
        expect(ics).toContain("SUMMARY:Bedpres");
    });

    it("escapes commas, semicolons, backslashes and newlines in text", () => {
        const ics = buildICalendar({
            name: "TIHLDE",
            productId: "tihlde.org",
            events: [
                {
                    ...baseEvent,
                    summary: "Pizza, øl; og\\kos",
                    description: "Linje 1\nLinje 2",
                },
            ],
        });

        expect(ics).toContain("SUMMARY:Pizza\\, øl\\; og\\\\kos");
        expect(ics).toContain("DESCRIPTION:Linje 1\\nLinje 2");
    });

    it("folds lines longer than 75 octets", () => {
        const ics = buildICalendar({
            name: "TIHLDE",
            productId: "tihlde.org",
            events: [{ ...baseEvent, summary: "æ".repeat(120) }],
        });

        const encoder = new TextEncoder();
        for (const line of ics.split("\r\n")) {
            expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
        }
        // Foldingen skal kunne reverseres til den opprinnelige teksten.
        expect(ics.replace(/\r\n /g, "")).toContain(
            `SUMMARY:${"æ".repeat(120)}`,
        );
    });
});
