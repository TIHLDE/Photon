import { getSearchTerms, matchesSearch } from "@photon/core/search";
import { describe, expect, it } from "vitest";

describe("word search", () => {
    it("splits case-insensitive words and ignores extra whitespace", () => {
        expect(getSearchTerms("  Stian\t WAlmann\n")).toEqual([
            "stian",
            "walmann",
        ]);
        expect(getSearchTerms(" \t\n")).toEqual([]);
    });

    it.each([
        "Stian Walmann",
        "Walmann Stian",
        "  STIAN\t WALMANN  ",
        "sti walm",
        "Stian scw123",
    ])("matches omitted middle names and fields: %s", (query) => {
        expect(matchesSearch(["Stian Closs Walmann", "scw123"], query)).toBe(
            true,
        );
    });

    it("requires every word to match the same record", () => {
        expect(matchesSearch(["Stian Other", "stian"], "Stian Walmann")).toBe(
            false,
        );
        expect(matchesSearch(["Other Walmann", null], "Stian Walmann")).toBe(
            false,
        );
        expect(matchesSearch(["St", "ian"], "Stian")).toBe(false);
    });

    it("handles empty queries and missing fields", () => {
        expect(matchesSearch([null, undefined], "")).toBe(true);
        expect(matchesSearch([null, undefined], "Stian")).toBe(false);
        expect(matchesSearch(["Kari", null, "Hansen"], "Hansen Kari")).toBe(
            true,
        );
    });

    it("keeps Norwegian letters and punctuation literal", () => {
        expect(matchesSearch(["Øystein Middle Åsen"], "ÅSEN øystein")).toBe(
            true,
        );
        expect(matchesSearch(["Literal %_\\ Person"], "%_\\ Literal")).toBe(
            true,
        );
        expect(matchesSearch(["Literal Person"], "Literal %_")).toBe(false);
    });

    it("matches words across an event participant's permitted fields", () => {
        expect(
            matchesSearch(
                ["Kari Hansen", "kari@example.test"],
                "Hansen example",
            ),
        ).toBe(true);
        expect(matchesSearch(["Kari Hansen", "No milk"], "Hansen milk")).toBe(
            true,
        );
    });
});
