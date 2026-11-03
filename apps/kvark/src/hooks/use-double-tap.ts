import { type PointerEvent, useRef } from "react";

/** Lengste pause mellom to trykk som regnes som et dobbelttrykk. */
const DOUBLE_TAP_MS = 300;
/** Så langt fingeren kan flytte seg mellom trykkene, i piksler. */
const DOUBLE_TAP_SLOP_PX = 30;

/**
 * Et dobbelttrykk med finger eller mus. `dblclick` holder ikke: iOS sender
 * den ikke for berøring. Et trykk som ble en rulling (fingeren flyttet seg
 * mellom ned og opp) teller ikke, så et sveip blir aldri en like. Det gjør
 * heller ikke trykk på knapper og lenker: to raske trykk på lik-knappen skal
 * lik(e) og fjerne liken, ikke også trigge et dobbelttrykk.
 */
export function useDoubleTap(onDoubleTap: () => void) {
    const down = useRef<{ x: number; y: number } | null>(null);
    const lastTap = useRef<{ x: number; y: number; at: number } | null>(null);

    return {
        onPointerDown(event: PointerEvent) {
            down.current = { x: event.clientX, y: event.clientY };
        },
        onPointerUp(event: PointerEvent) {
            const start = down.current;
            down.current = null;
            const onControl =
                event.target instanceof Element &&
                event.target.closest("button, a, input, textarea") !== null;
            if (
                !start ||
                onControl ||
                Math.hypot(event.clientX - start.x, event.clientY - start.y) >
                    DOUBLE_TAP_SLOP_PX
            ) {
                lastTap.current = null;
                return;
            }

            const now = event.timeStamp;
            const previous = lastTap.current;
            if (
                previous &&
                now - previous.at < DOUBLE_TAP_MS &&
                Math.hypot(
                    event.clientX - previous.x,
                    event.clientY - previous.y,
                ) < DOUBLE_TAP_SLOP_PX
            ) {
                lastTap.current = null;
                onDoubleTap();
                return;
            }
            lastTap.current = { x: event.clientX, y: event.clientY, at: now };
        },
        onPointerCancel() {
            down.current = null;
            lastTap.current = null;
        },
    };
}
