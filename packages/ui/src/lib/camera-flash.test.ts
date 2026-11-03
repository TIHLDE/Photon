import { describe, expect, it } from "vitest";

import {
    FLASH_DARK_LUMINANCE_THRESHOLD,
    meanLuminance,
    shouldFireFlash,
} from "#/lib/camera-flash";

function solid(r: number, g: number, b: number, pixels = 4) {
    return Uint8ClampedArray.from(
        Array.from({ length: pixels }, () => [r, g, b, 255]).flat(),
    );
}

describe("meanLuminance", () => {
    it("is 0 for black, 1 for white and 0 for no data", () => {
        expect(meanLuminance(solid(0, 0, 0))).toBe(0);
        expect(meanLuminance(solid(255, 255, 255))).toBeCloseTo(1);
        expect(meanLuminance([])).toBe(0);
    });

    it("weighs green over red over blue", () => {
        const green = meanLuminance(solid(0, 255, 0));
        const red = meanLuminance(solid(255, 0, 0));
        const blue = meanLuminance(solid(0, 0, 255));
        expect(green).toBeGreaterThan(red);
        expect(red).toBeGreaterThan(blue);
    });

    it("averages over all pixels and ignores alpha", () => {
        const data = Uint8ClampedArray.from([
            ...[255, 255, 255, 0],
            ...[0, 0, 0, 0],
        ]);
        expect(meanLuminance(data)).toBeCloseTo(0.5);
    });
});

describe("shouldFireFlash", () => {
    it("always fires on and never fires off, whatever the light", () => {
        expect(shouldFireFlash("on", 1)).toBe(true);
        expect(shouldFireFlash("off", 0)).toBe(false);
    });

    it("fires auto only below the threshold", () => {
        expect(
            shouldFireFlash("auto", FLASH_DARK_LUMINANCE_THRESHOLD - 0.01),
        ).toBe(true);
        expect(shouldFireFlash("auto", FLASH_DARK_LUMINANCE_THRESHOLD)).toBe(
            false,
        );
        expect(shouldFireFlash("auto", 0.9)).toBe(false);
    });
});
