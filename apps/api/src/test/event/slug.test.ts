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

    it("falls back to 'event' when a title slugs to nothing", () => {
        // The migration has titles made only of emoji or punctuation.
        expect(buildEventSlugBase("💜", new Date("2026-03-17T18:00:00Z"))).toBe(
            "event-2026-03-17",
        );
    });
});
