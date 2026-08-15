import { useRender } from "@base-ui/react/use-render";
import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type ComponentProps,
} from "react";

import { cn } from "#/lib/utils";

/** Hvor lang uttoningen er i hver kant. */
const FADE_LENGTH = "1.5rem";

function edgeMask(fadeStart: boolean, fadeEnd: boolean) {
    // Uten uttoning i en kant legges stoppene på 0 % / 100 %, altså en maske
    // som ikke skjuler noe. Da kan gradienten stå på hele tiden i stedet for å
    // slås av og på, og kantene kan tones inn og ut.
    const start = fadeStart ? FADE_LENGTH : "0px";
    const end = fadeEnd ? FADE_LENGTH : "0px";
    return `linear-gradient(to right, transparent 0, #000 ${start}, #000 calc(100% - ${end}), transparent 100%)`;
}

type ScrollFadeProps = ComponentProps<"div"> & {
    render?: useRender.RenderProp;
};

/**
 * Vannrett scrollcontainer som toner ut innholdet i kantene der det finnes mer
 * å scrolle til. Uttoningen ligger bare på den siden som faktisk har skjult
 * innhold, slik at en liste som får plass ser helt vanlig ut.
 */
function ScrollFade({ className, render, ...props }: ScrollFadeProps) {
    const ref = useRef<HTMLDivElement>(null);
    const [edges, setEdges] = useState({ start: false, end: false });

    const sync = useCallback(() => {
        const el = ref.current;
        if (!el) return;
        const max = el.scrollWidth - el.clientWidth;
        // Subpiksel-avrunding gjør at scrollLeft sjelden treffer 0 eller max
        // helt presist, så kantene regnes som nådd innenfor én piksel.
        const offset = Math.abs(el.scrollLeft);
        setEdges({ start: offset > 1, end: offset < max - 1 });
    }, []);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        sync();
        // Innholdet kan endre bredde uten at containeren gjør det (faner som
        // dukker opp, fonter som lastes), så begge observeres.
        const observer = new ResizeObserver(sync);
        observer.observe(el);
        for (const child of el.children) observer.observe(child);
        return () => observer.disconnect();
    }, [sync]);

    const mask = edgeMask(edges.start, edges.end);

    return useRender({
        render: render ?? <div />,
        props: {
            ref,
            "data-slot": "scroll-fade",
            onScroll: sync,
            className: cn(
                // overflow-y-hidden er ikke overflødig: per CSS-spec beregnes
                // den andre aksen til `auto` når én akse settes, så
                // `overflow-x-auto` alene gjør boksen til en vertikal
                // scrollcontainer og lar innholdet rubberband-e på iOS.
                "min-w-0 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                className,
            ),
            style: { maskImage: mask, WebkitMaskImage: mask },
            ...props,
        },
    });
}

export { ScrollFade };
