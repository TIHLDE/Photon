import { describe, expect, it } from "vitest";

import {
    DOUBLE_TAP_MAX_DISTANCE_PX,
    DOUBLE_TAP_MAX_GAP_MS,
    TAP_MAX_TRAVEL_PX,
    createDoubleTapDetector,
} from "#/lib/double-tap";

function tap(
    detector: ReturnType<typeof createDoubleTapDetector>,
    x: number,
    y: number,
    time: number,
) {
    detector.down(x, y);
    return detector.up(x, y, time);
}

describe("createDoubleTapDetector", () => {
    it("fires on the second of two quick, close taps", () => {
        const detector = createDoubleTapDetector();
        expect(tap(detector, 100, 100, 0)).toBe(false);
        expect(tap(detector, 110, 100, 200)).toBe(true);
    });

    it("does not fire when the taps are too far apart in time", () => {
        const detector = createDoubleTapDetector();
        tap(detector, 100, 100, 0);
        expect(tap(detector, 100, 100, DOUBLE_TAP_MAX_GAP_MS + 1)).toBe(false);
    });

    it("does not fire when the taps are too far apart in space", () => {
        const detector = createDoubleTapDetector();
        tap(detector, 100, 100, 0);
        expect(
            tap(detector, 100 + DOUBLE_TAP_MAX_DISTANCE_PX + 1, 100, 100),
        ).toBe(false);
    });

    it("fires once for three quick taps", () => {
        const detector = createDoubleTapDetector();
        tap(detector, 100, 100, 0);
        expect(tap(detector, 100, 100, 100)).toBe(true);
        expect(tap(detector, 100, 100, 200)).toBe(false);
    });

    it("ignores a drag", () => {
        const detector = createDoubleTapDetector();
        tap(detector, 100, 100, 0);
        detector.down(100, 100);
        expect(detector.up(100 + TAP_MAX_TRAVEL_PX + 1, 100, 100)).toBe(false);
    });

    it("forgets the first tap after reset", () => {
        const detector = createDoubleTapDetector();
        tap(detector, 100, 100, 0);
        detector.reset();
        expect(tap(detector, 100, 100, 100)).toBe(false);
    });
});
