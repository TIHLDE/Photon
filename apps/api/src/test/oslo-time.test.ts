import { currentAcademicYear, osloDateParts } from "@photon/auth/academic-year";
import { describe, expect, test } from "vitest";
import {
    formatOsloDate,
    formatOsloDateTime,
    isoDateInOslo,
    startOfTodayInOslo,
} from "~/lib/oslo-day";

/**
 * The API container runs UTC while everyone reading it is in Norway, so every
 * rendered time and every "which day is it" decision has to name the zone.
 * These cases are the ones that were wrong in production: the two hours after
 * Norwegian midnight, where the UTC day is still yesterday.
 */
describe("Norwegian calendar day", () => {
    test("the two hours after Oslo midnight belong to the new day", () => {
        // 26 Aug 22:30 UTC is 27 Aug 00:30 in Oslo.
        const justAfterMidnight = new Date("2026-08-26T22:30:00Z");
        expect(isoDateInOslo(justAfterMidnight)).toBe("2026-08-27");
        // The UTC date of the same instant is the day before.
        expect(justAfterMidnight.toISOString().slice(0, 10)).toBe("2026-08-26");
    });

    test("the last minute before Oslo midnight still belongs to the old day", () => {
        expect(isoDateInOslo(new Date("2026-08-26T21:59:59Z"))).toBe(
            "2026-08-26",
        );
    });

    test("start of today is Oslo midnight, in both summer and winter time", () => {
        // Summer: UTC+2, so midnight Oslo is 22:00 UTC the day before.
        expect(
            startOfTodayInOslo(new Date("2026-08-26T22:30:00Z")).toISOString(),
        ).toBe("2026-08-26T22:00:00.000Z");
        // Winter: UTC+1, so midnight Oslo is 23:00 UTC the day before.
        expect(
            startOfTodayInOslo(new Date("2026-01-15T23:30:00Z")).toISOString(),
        ).toBe("2026-01-15T23:00:00.000Z");
    });

    test("an instant is never before the start of its own Norwegian day", () => {
        // The job list keeps an ad whose deadline is `>= startOfTodayInOslo()`,
        // which only means "expires today or later" if this holds.
        for (const iso of [
            "2026-08-26T22:00:00Z", // exactly Oslo midnight
            "2026-08-26T22:30:00Z", // the hour that used to fall through
            "2026-03-29T00:30:00Z", // spring-forward night
            "2026-10-25T00:30:00Z", // fall-back night
            "2026-12-31T23:30:00Z", // new year in Norway
        ]) {
            const instant = new Date(iso);
            expect(startOfTodayInOslo(instant).getTime()).toBeLessThanOrEqual(
                instant.getTime(),
            );
        }
    });
});

describe("academic year", () => {
    test("rolls over at Oslo midnight on 1 August, not at UTC midnight", () => {
        // 31 July 22:30 UTC = 1 August 00:30 in Norway.
        expect(currentAcademicYear(new Date("2026-07-31T22:30:00Z"))).toBe(
            2026,
        );
        // 31 July 21:30 UTC = 31 July 23:30 in Norway.
        expect(currentAcademicYear(new Date("2026-07-31T21:30:00Z"))).toBe(
            2025,
        );
    });

    test("the Feide registration windows read the Norwegian day", () => {
        // The autumn window runs through 15 August. 15 Aug 23:30 in Norway is
        // 21:30 UTC, and 16 Aug 00:30 in Norway is 22:30 UTC on the 15th —
        // read in UTC, the window closed a day late and opened two hours late.
        expect(osloDateParts(new Date("2026-08-15T21:30:00Z"))).toEqual([
            2026, 7, 15,
        ]);
        expect(osloDateParts(new Date("2026-08-15T22:30:00Z"))).toEqual([
            2026, 7, 16,
        ]);
    });

    test("a spring instant belongs to the intake that started last August", () => {
        expect(currentAcademicYear(new Date("2027-03-15T12:00:00Z"))).toBe(
            2026,
        );
    });
});

describe("rendering", () => {
    test("renders Norwegian wall-clock time, not the container's", () => {
        const signedAt = new Date("2026-08-26T22:30:00Z");
        expect(
            formatOsloDateTime(signedAt, {
                dateStyle: "medium",
                timeStyle: "short",
            }),
        ).toBe("27. aug. 2026, 00:30");
        expect(
            formatOsloDate(signedAt, {
                day: "numeric",
                month: "long",
                year: "numeric",
            }),
        ).toBe("27. august 2026");
    });
});
