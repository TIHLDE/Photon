import { buildEventSlugBase, slugifyText } from "@photon/core/slug";
import { describe, expect, it } from "vitest";

describe("slugifyText", () => {
    it("transliterates the Norwegian letters Unicode does not decompose", () => {
        // ø and æ survive NFD, so they used to fall through the a-z filter and
        // become hyphens — "Søndagsplask" turned into "s-ndagsplask".
        expect(slugifyText("Søndagsplask")).toBe("sondagsplask");
        expect(slugifyText("Æresmedlem")).toBe("aeresmedlem");
        expect(slugifyText("Støtt Pythons herrer")).toBe(
            "stott-pythons-herrer",
        );
    });

    it("still strips the accents NFD does decompose", () => {
        expect(slugifyText("Åpningskamp")).toBe("apningskamp");
        expect(slugifyText("Café & Crème")).toBe("cafe-creme");
    });

    it("collapses punctuation, emoji and whitespace into single hyphens", () => {
        expect(slugifyText("Bedpres  med   Bekk!")).toBe("bedpres-med-bekk");
        expect(slugifyText("Vinkurs 💜 2026")).toBe("vinkurs-2026");
    });

    it("trims leading and trailing hyphens", () => {
        expect(slugifyText("!! Julebord !!")).toBe("julebord");
    });
});

describe("buildEventSlugBase", () => {
    it("appends the start date so repeated titles stay distinguishable", () => {
        expect(
            buildEventSlugBase(
                "Søndagsplask",
                new Date("2026-03-17T18:00:00Z"),
            ),
        ).toBe("sondagsplask-2026-03-17");
    });

    it("uses the Oslo date, not the UTC one, for midnight starts", () => {
        // 15 Jan 00:00 in Oslo is 14 Jan 23:00 UTC. Slugging off the UTC date
        // put 22 of TIHLDE's events on the wrong day, and made the API import
        // and the MySQL migration disagree about the same event.
        expect(
            buildEventSlugBase(
                "TIHLDE til Åre",
                new Date("2026-01-15T00:00:00+01:00"),
            ),
        ).toBe("tihlde-til-are-2026-01-15");
    });

    it("uses the Oslo date during summer time too", () => {
        // +02:00 in July, so midnight local is 22:00 UTC the previous day.
        expect(
            buildEventSlugBase(
                "Sommerfest",
                new Date("2026-07-04T00:00:00+02:00"),
            ),
        ).toBe("sommerfest-2026-07-04");
    });

    it("falls back to 'event' when a title slugs to nothing", () => {
        // The migration has titles made only of emoji or punctuation.
        expect(buildEventSlugBase("💜", new Date("2026-03-17T18:00:00Z"))).toBe(
            "event-2026-03-17",
        );
    });
});
