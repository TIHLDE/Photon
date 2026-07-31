import { Button } from "@tihlde/ui/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@tihlde/ui/ui/tooltip";
import { Check, Copy, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type ShareButtonProps = {
    /** Overstyr lenken som deles. Standard er siden man står på. */
    url?: string;
    label?: string;
    /** Vis teksten ved siden av ikonet i stedet for kun ikonknapp. */
    showLabel?: boolean;
    onShare?: () => void;
};

/**
 * Deler en lenke: mobil får den native delingsmenyen, alt annet får lenken
 * kopiert til utklippstavlen. Knappen hadde ingen standardhandling før, så
 * «Del»-knappene på nyheter, arrangementer og stillinger gjorde ingenting.
 *
 * Ikonet følger handlingen: et dele-ikon der nettleseren faktisk åpner en
 * delingsmeny, ellers et kopier-ikon — «del» på en knapp som bare kopierer
 * lover mer enn den holder.
 */
export function ShareButton({
    url,
    label = "Del",
    showLabel = false,
    onShare,
}: ShareButtonProps) {
    const [copied, setCopied] = useState(false);
    const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Sjekkes etter hydrering: `navigator` finnes ikke under SSR, og server og
    // klient må rendre det samme ikonet i første pass.
    const [canShareNatively, setCanShareNatively] = useState(false);

    useEffect(() => {
        setCanShareNatively(
            typeof navigator !== "undefined" && !!navigator.share,
        );
    }, []);

    useEffect(
        () => () => {
            if (resetTimer.current) clearTimeout(resetTimer.current);
        },
        [],
    );

    async function share() {
        onShare?.();
        const href = url ?? window.location.href;

        if (navigator.share) {
            try {
                await navigator.share({ url: href });
                return;
            } catch {
                // Avbrutt eller avvist — fall tilbake til utklippstavlen.
            }
        }

        try {
            await navigator.clipboard.writeText(href);
            setCopied(true);
            if (resetTimer.current) clearTimeout(resetTimer.current);
            resetTimer.current = setTimeout(() => setCopied(false), 2000);
        } catch {
            // Utklippstavlen er blokkert; ingenting fornuftig å gjøre her.
        }
    }

    const actionLabel = canShareNatively ? label : "Kopier lenke";
    const tooltip = copied ? "Lenke kopiert" : actionLabel;
    const Icon = canShareNatively ? Share2 : Copy;

    return (
        <Tooltip>
            <TooltipTrigger
                render={
                    <Button
                        variant="outline"
                        size={showLabel ? "sm" : "icon"}
                        onClick={share}
                        aria-label={actionLabel}
                    >
                        {copied ? <Check /> : <Icon />}
                        {showLabel ? (copied ? "Kopiert" : actionLabel) : null}
                    </Button>
                }
            />
            <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
    );
}
