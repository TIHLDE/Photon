import { useEffect, useRef, useState } from "react";

/**
 * Object-URL-er for private bilder, som ikke kan brukes som `<img src>` fordi
 * nettleseren ikke sender sesjonen på tvers av origins.
 *
 * En sti mangler i kartet mens den hentes, og har `null` hvis hentingen
 * feilet. Hver sti hentes én gang, også når lista refetches med nye objekter. Alle
 * URL-er frigjøres når komponenten avmonteres. Svar som kommer etter at den
 * er avmontert, frigjøres med en gang.
 *
 * Med `releaseDropped` frigjøres også en URL så snart stien forsvinner fra
 * lista, og den hentes på nytt hvis den kommer tilbake. Det er for lister som
 * er et vindu rundt det som vises — storyen holder bare bildene nær det man
 * ser på, ellers fyller hundrevis av bilder i full størrelse opp minnet på
 * telefonen.
 */
export function useObjectUrls(
    paths: readonly string[],
    fetchObjectUrl: (path: string) => Promise<string>,
    { releaseDropped = false }: { releaseDropped?: boolean } = {},
): ReadonlyMap<string, string | null> {
    const [urls, setUrls] = useState<ReadonlyMap<string, string | null>>(
        () => new Map(),
    );
    const requested = useRef(new Set<string>());
    const owned = useRef(new Map<string, string>());
    // Øker ved avmontering, så et svar fra en tidligere montering (StrictMode
    // monterer to ganger i dev) ikke havner i tilstanden.
    const generation = useRef(0);

    useEffect(
        () => () => {
            generation.current += 1;
            for (const url of owned.current.values()) {
                URL.revokeObjectURL(url);
            }
            owned.current.clear();
            requested.current.clear();
            setUrls(new Map());
        },
        [],
    );

    useEffect(() => {
        const current = generation.current;
        const wanted = new Set(paths);

        if (releaseDropped) {
            const dropped = [...requested.current].filter(
                (path) => !wanted.has(path),
            );
            for (const path of dropped) {
                requested.current.delete(path);
                const url = owned.current.get(path);
                if (url) URL.revokeObjectURL(url);
                owned.current.delete(path);
            }
            if (dropped.length > 0) {
                setUrls((previous) => {
                    const next = new Map(previous);
                    for (const path of dropped) next.delete(path);
                    return next;
                });
            }
        }

        for (const path of paths) {
            if (requested.current.has(path)) continue;
            requested.current.add(path);

            fetchObjectUrl(path)
                .then((url) => {
                    // Avmontert, eller stien ble droppet mens den ble hentet. Eller
                    // droppet og bedt om igjen før svaret kom: den andre
                    // hentingen er allerede lagret.
                    if (
                        generation.current !== current ||
                        (releaseDropped && !requested.current.has(path)) ||
                        owned.current.has(path)
                    ) {
                        URL.revokeObjectURL(url);
                        return;
                    }
                    owned.current.set(path, url);
                    setUrls((previous) => new Map(previous).set(path, url));
                })
                .catch((error: unknown) => {
                    console.error("Kunne ikke hente bilde", path, error);
                    if (generation.current !== current) return;
                    setUrls((previous) => new Map(previous).set(path, null));
                });
        }
    }, [paths, fetchObjectUrl, releaseDropped]);

    return urls;
}
