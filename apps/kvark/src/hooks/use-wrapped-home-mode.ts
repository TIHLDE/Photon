import { useCallback, useSyncExternalStore } from "react";

export type WrappedHomeMode = "wrapped" | "normal";

const STORAGE_PREFIX = "wrapped-home-mode:";

/**
 * Valget bor i minnet i tillegg til sessionStorage: `_app.tsx` og forsida er to
 * komponenter som må se det samme, og hvis lagringa er sperret (privat modus,
 * full kvote) skal knappen likevel virke så lenge fanen lever.
 */
const modes = new Map<string, WrappedHomeMode>();
const loaded = new Set<string>();
const listeners = new Set<() => void>();

function readStored(eventId: string): WrappedHomeMode | null {
    try {
        const value = window.sessionStorage.getItem(STORAGE_PREFIX + eventId);
        return value === "normal" || value === "wrapped" ? value : null;
    } catch (error) {
        console.warn("Could not read wrapped home mode from storage", error);
        return null;
    }
}

function getSnapshot(eventId: string | undefined): WrappedHomeMode {
    if (!eventId) return "wrapped";
    if (!loaded.has(eventId)) {
        loaded.add(eventId);
        const stored = readStored(eventId);
        if (stored) modes.set(eventId, stored);
    }
    return modes.get(eventId) ?? "wrapped";
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/**
 * Hvilken forside medlemmet ser mens kameraet er åpent: «wrapped» (ett kort,
 * ingen scrolling) eller «normal». Ett valg per arrangement, i sessionStorage,
 * så det holder mens man blar rundt i samme fane, men en ny fane starter på
 * wrapped.
 *
 * `useSyncExternalStore` gir «wrapped» på serveren og i den første
 * klient-rendringen under hydrering, og leser først lagringa etterpå. Dermed
 * blir HTML-en lik på begge sider.
 */
export function useWrappedHomeMode(eventId: string | undefined) {
    const mode = useSyncExternalStore(
        subscribe,
        () => getSnapshot(eventId),
        () => "wrapped" as const,
    );

    const setMode = useCallback(
        (next: WrappedHomeMode) => {
            if (!eventId) return;
            console.log("Wrapped home mode", next);
            modes.set(eventId, next);
            try {
                window.sessionStorage.setItem(STORAGE_PREFIX + eventId, next);
            } catch (error) {
                console.warn(
                    "Could not save wrapped home mode to storage",
                    error,
                );
            }
            listeners.forEach((listener) => listener());
        },
        [eventId],
    );

    return { mode, setMode };
}
