/** Longest pause between the first tap lifting and the second one lifting. */
export const DOUBLE_TAP_MAX_GAP_MS = 300;

/** Furthest the two taps may land from each other. */
export const DOUBLE_TAP_MAX_DISTANCE_PX = 30;

/** Furthest a finger may travel between down and up and still be a tap. */
export const TAP_MAX_TRAVEL_PX = 10;

type Point = { x: number; y: number };

/**
 * Tells a double tap from two stray touches. Pure: the caller feeds it
 * pointer coordinates and timestamps, so it has no DOM and no timers.
 *
 * `up()` returns true on the second tap of a pair. The pair is then used up,
 * so a third quick tap starts a new one instead of firing again.
 */
export function createDoubleTapDetector() {
    let start: Point | null = null;
    let last: (Point & { time: number }) | null = null;

    const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

    return {
        down(x: number, y: number) {
            start = { x, y };
        },
        up(x: number, y: number, time: number): boolean {
            const from = start;
            start = null;
            // A drag or a swipe is not a tap.
            if (!from || distance(from, { x, y }) > TAP_MAX_TRAVEL_PX) {
                last = null;
                return false;
            }
            if (
                last &&
                time - last.time <= DOUBLE_TAP_MAX_GAP_MS &&
                distance(last, { x, y }) <= DOUBLE_TAP_MAX_DISTANCE_PX
            ) {
                last = null;
                return true;
            }
            last = { x, y, time };
            return false;
        },
        /** Forget everything, so a half-finished pair never carries over. */
        reset() {
            start = null;
            last = null;
        },
    };
}
