import { useRender } from "@base-ui/react/use-render";
import * as React from "react";

import { cn } from "#/lib/utils";

/**
 * Setter linja på plass igjen når iOS Safari har mistet den.
 *
 * Safari tegner `position: fixed` i et eget lag, og laget følger ikke alltid
 * med når viewporten endrer seg mens sida ligger i bakgrunnen. Å komme
 * tilbake fra Vipps er nettopp et slikt øyeblikk: sida fryses, Vipps overtar
 * skjermen, og når medlemmet er tilbake blir linja stående igjen midt på
 * skjermen. Ingenting i CSS-en kan uttrykke «tegn denne på nytt», så vi tvinger
 * fram en ny layout av elementet i det sida kommer til syne igjen. Det koster
 * ingenting når alt er som det skal.
 */
function useRepinOnViewportChange(ref: React.RefObject<HTMLElement | null>) {
    React.useEffect(() => {
        const node = ref.current;
        if (!node) return;

        function repin() {
            if (!node) return;
            const previous = node.style.display;
            node.style.display = "none";
            // Lesingen er poenget: den tvinger fram layouten før vi setter
            // display tilbake, ellers slår nettleseren de to sammen til ingen
            // endring i det hele tatt.
            void node.offsetHeight;
            node.style.display = previous;
        }

        function onPageShow(event: PageTransitionEvent) {
            // Bare den gjenopprettede sida er interessant; en fersk lasting
            // har aldri et gammelt lag å rette opp.
            if (event.persisted) repin();
        }

        function onVisibilityChange() {
            if (document.visibilityState === "visible") repin();
        }

        // Bare de to hendelsene: `visualViewport`-endringer fyrer i tett
        // rekkefølge mens Safari skjuler adresselinja under scrolling, og en
        // ny layout per hendelse ville kostet mer enn den retter opp.
        window.addEventListener("pageshow", onPageShow);
        document.addEventListener("visibilitychange", onVisibilityChange);

        return () => {
            window.removeEventListener("pageshow", onPageShow);
            document.removeEventListener(
                "visibilitychange",
                onVisibilityChange,
            );
        };
    }, [ref]);
}

function BottomBar({ className, ref, ...props }: React.ComponentProps<"nav">) {
    const innerRef = React.useRef<HTMLElement | null>(null);
    useRepinOnViewportChange(innerRef);

    return (
        <nav
            data-slot="bottom-bar"
            ref={(node) => {
                innerRef.current = node;
                if (typeof ref === "function") return ref(node);
                if (ref) ref.current = node;
            }}
            className={cn(
                // `pb-safe` keeps the row clear of the iOS home indicator, which
                // otherwise sits right on top of the labels.
                //
                // Ingen `backdrop-filter` her, i motsetning til headeren:
                // et fastlåst element med bakgrunnsuskarphet får sitt eget
                // komposittlag i WebKit, og det er nettopp de lagene som blir
                // hengende igjen på feil sted. Bakgrunnen er derfor tett nok
                // til å stå på egne bein.
                "fixed inset-x-0 bottom-0 z-40 border-t bg-background pb-[env(safe-area-inset-bottom)]",
                className,
            )}
            {...props}
        />
    );
}

type BottomBarItemProps = React.ComponentProps<"button"> & {
    render?: useRender.RenderProp;
};

function BottomBarItem({ className, render, ...props }: BottomBarItemProps) {
    return useRender({
        render: render ?? <button type="button" />,
        props: {
            "data-slot": "bottom-bar-item",
            className: cn(
                // TanStack Router marks the matching link with data-status=active;
                // anything else (the menu button) simply never gets the attribute.
                // `wrap-normal` overstyrer den globale `overflow-wrap: anywhere`:
                // etikettene her er korte og faste, og skal aldri deles midt i
                // et ord («Arrangement/er»). De får heller krympe teksten.
                "flex flex-1 cursor-pointer flex-col items-center gap-1 rounded-lg px-2 py-1.5 text-center text-[0.6875rem] font-medium wrap-normal text-muted-foreground outline-none transition-colors select-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-[status=active]:text-foreground [&_svg]:size-5 [&_svg]:shrink-0",
                className,
            ),
            ...props,
        },
    });
}

export { BottomBar, BottomBarItem };
