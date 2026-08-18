import { describe, expect, it } from "vitest";
import { buildPaymentDescription } from "~/lib/vipps";

describe("buildPaymentDescription", () => {
    it("leads with the payer's name so admins can see who paid", () => {
        expect(
            buildPaymentDescription("Bedpres med Bekk", "Ola Nordmann"),
        ).toBe("Ola Nordmann - Bedpres med Bekk");
    });

    it("falls back to the label alone when no name is known", () => {
        expect(buildPaymentDescription("Bedpres med Bekk")).toBe(
            "Bedpres med Bekk",
        );
        expect(buildPaymentDescription("Bedpres med Bekk", "   ")).toBe(
            "Bedpres med Bekk",
        );
    });

    it("truncates to the 100 character limit Vipps enforces", () => {
        const description = buildPaymentDescription("x".repeat(200), "Ola");
        expect(description).toHaveLength(100);
        expect(description.startsWith("Ola - ")).toBe(true);
    });
});
