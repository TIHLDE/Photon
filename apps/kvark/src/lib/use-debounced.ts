import { useEffect, useState } from "react";

/** Debounce a string value (for search-as-you-type). */
export function useDebounced(value: string, delayMs = 200): string {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const timeout = window.setTimeout(
            () => setDebounced(value.trim()),
            delayMs,
        );
        return () => window.clearTimeout(timeout);
    }, [value, delayMs]);
    return debounced;
}
