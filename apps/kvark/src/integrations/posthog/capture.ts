import posthog from "posthog-js";
import type { Properties } from "posthog-js";

/**
 * Samme feil rapporteres fra flere hold: `QueryCache` ser det feilende kallet,
 * rutas feilgrense ser det igjen, og hvert nye forsøk lager et nytt
 * error-objekt. Under en API-nedetid ble én sidelast til over ti rapporter.
 * PostHog rate-limiter ikke manuelle kall, så vi må gjøre det selv — og på
 * innhold, ikke objektidentitet.
 */
const DEDUPE_WINDOW_MS = 10_000;

const lastReported = new Map<string, number>();

function signature(error: unknown): string {
    return error instanceof Error
        ? `${error.name}: ${error.message}`
        : String(error);
}

export function captureException(error: unknown, properties?: Properties) {
    /**
     * Kalles også under SSR og fra dev uten `VITE_POSTHOG_KEY`. Klienten er da
     * uinitialisert, og et kall rett på `posthog` logger bare en advarsel.
     */
    if (!posthog.__loaded) return;

    const key = signature(error);
    const now = Date.now();

    if (now - (lastReported.get(key) ?? -Infinity) < DEDUPE_WINDOW_MS) return;

    for (const [seen, at] of lastReported) {
        if (now - at >= DEDUPE_WINDOW_MS) lastReported.delete(seen);
    }
    lastReported.set(key, now);

    posthog.captureException(error, properties);
}
