import { useSyncExternalStore } from "react";

/**
 * Whether a CSS media query currently matches.
 *
 * Returns `false` during SSR — there is no viewport to measure on the server,
 * so components must render something sensible for the "no match" case.
 */
export function useMediaQuery(query: string): boolean {
    return useSyncExternalStore(
        (onChange) => {
            const mql = window.matchMedia(query);
            mql.addEventListener("change", onChange);
            return () => mql.removeEventListener("change", onChange);
        },
        () => window.matchMedia(query).matches,
        () => false,
    );
}
