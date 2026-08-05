import { useEffect, useRef } from "react";

import { Button } from "#/components/ui/button";

import type { SpellcheckSelection } from "./spellcheck-extension";

export type SpellSuggestionsProps = {
    selection: SpellcheckSelection;
    /** Elementet boblen plasseres inni. Brukes til å regne om koordinatene. */
    container: HTMLElement | null;
    onApply: (replacement: string) => void;
    onDismiss: () => void;
};

/**
 * Boblen som viser hva som er galt med ordet under den røde streken, og hvilke
 * ord ordboka foreslår i stedet. Uten den er streken bare en beskjed om at noe
 * er feil, og skriveren må gjette hva.
 */
export function SpellSuggestions({
    selection,
    container,
    onApply,
    onDismiss,
}: SpellSuggestionsProps) {
    const popupRef = useRef<HTMLDivElement>(null);
    const firstSuggestionRef = useRef<HTMLButtonElement>(null);

    // Første forslaget tar fokus, slik at lista kan bla-es gjennom med
    // tastaturet. `preventScroll` holder teksten i ro — hopper siden, mister
    // skriveren stedet hen var.
    useEffect(() => {
        firstSuggestionRef.current?.focus({ preventScroll: true });
    }, []);

    // Klikk utenfor og Escape lukker boblen. Klikk inne i editoren håndteres av
    // stavekontrollen selv, som melder fra at ingen feil ble truffet.
    useEffect(() => {
        function onPointerDown(event: PointerEvent) {
            if (!popupRef.current) return;
            if (popupRef.current.contains(event.target as globalThis.Node))
                return;
            onDismiss();
        }
        function onKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") onDismiss();
        }

        document.addEventListener("pointerdown", onPointerDown);
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [onDismiss]);

    const bounds = container?.getBoundingClientRect();
    const top = selection.rect.bottom - (bounds?.top ?? 0) + 4;
    const left = selection.rect.left - (bounds?.left ?? 0);

    return (
        <div
            ref={popupRef}
            role="dialog"
            aria-label={`Forslag for ${selection.word}`}
            style={{ top, left }}
            className="absolute z-50 flex w-56 flex-col gap-1 rounded-lg bg-popover p-1.5 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10"
        >
            <p className="px-1.5 pt-0.5 text-muted-foreground text-xs">
                «{selection.word}» står ikke i ordboka
            </p>

            {selection.suggestions.length === 0 ? (
                <p className="px-1.5 pb-0.5 text-muted-foreground text-xs">
                    Ordboka har ingen forslag.
                </p>
            ) : (
                selection.suggestions.map((suggestion, index) => (
                    <Button
                        key={suggestion}
                        ref={index === 0 ? firstSuggestionRef : undefined}
                        variant="ghost"
                        size="sm"
                        className="h-7 justify-start px-1.5 font-normal"
                        onClick={() => onApply(suggestion)}
                    >
                        {suggestion}
                    </Button>
                ))
            )}
        </div>
    );
}
