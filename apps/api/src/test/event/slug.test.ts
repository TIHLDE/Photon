import { describe, expect, it } from "vitest";
import { slugifyTitle } from "~/lib/event/slug";

describe("slugifyTitle", () => {
    it("transliterates the Norwegian letters Unicode does not decompose", () => {
        // ø and æ survive NFD, so they used to fall through the a-z filter and
        // become hyphens — "Søndagsplask" turned into "s-ndagsplask".
        expect(slugifyTitle("Søndagsplask")).toBe("sondagsplask");
        expect(slugifyTitle("Æresmedlem")).toBe("aeresmedlem");
        expect(slugifyTitle("Støtt Pythons herrer")).toBe(
            "stott-pythons-herrer",
        );
    });

    it("still strips the accents NFD does decompose", () => {
        expect(slugifyTitle("Åpningskamp")).toBe("apningskamp");
        expect(slugifyTitle("Café & Crème")).toBe("cafe-creme");
    });

    it("collapses punctuation, emoji and whitespace into single hyphens", () => {
        expect(slugifyTitle("Bedpres  med   Bekk!")).toBe("bedpres-med-bekk");
        expect(slugifyTitle("Vinkurs 💜 2026")).toBe("vinkurs-2026");
    });

    it("trims leading and trailing hyphens", () => {
        expect(slugifyTitle("!! Julebord !!")).toBe("julebord");
    });
});
