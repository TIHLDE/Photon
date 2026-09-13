import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";

import { cn } from "#/lib/utils";

function TooltipProvider({
    delay = 0,
    ...props
}: TooltipPrimitive.Provider.Props) {
    return (
        <TooltipPrimitive.Provider
            data-slot="tooltip-provider"
            delay={delay}
            {...props}
        />
    );
}

function Tooltip({ ...props }: TooltipPrimitive.Root.Props) {
    return <TooltipPrimitive.Root data-slot="tooltip" {...props} />;
}

function TooltipTrigger({ ...props }: TooltipPrimitive.Trigger.Props) {
    return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

/**
 * Pilen skal lese som en tagg på boksen, ikke som en egen figur.
 *
 * Den ligger midt på kanten, halvparten innenfor: den innenfor-halvdelen
 * dekker boksens egen ramme, og rammen på de to yttersidene fortsetter der
 * boksens slutter. Derfor er rammen satt per side og ikke hele veien rundt —
 * en ramme på alle fire kantene tegner to streker tvers over boksen.
 *
 * Rotasjonen går med klokka, så kantene bytter plass: `border-r`/`border-b`
 * peker ned, `border-t`/`border-l` peker opp.
 */
const ARROW_CLASSES = [
    "size-2.5 rotate-45 rounded-[2px] bg-popover border-foreground/10",
    "data-[side=top]:-bottom-[5px] data-[side=top]:border-r data-[side=top]:border-b",
    "data-[side=bottom]:-top-[5px] data-[side=bottom]:border-t data-[side=bottom]:border-l",
    "data-[side=left]:-right-[5px] data-[side=left]:border-t data-[side=left]:border-r",
    "data-[side=right]:-left-[5px] data-[side=right]:border-b data-[side=right]:border-l",
    "data-[side=inline-start]:-right-[5px] data-[side=inline-start]:border-t data-[side=inline-start]:border-r",
    "data-[side=inline-end]:-left-[5px] data-[side=inline-end]:border-b data-[side=inline-end]:border-l",
].join(" ");

function TooltipContent({
    className,
    side = "top",
    sideOffset = 4,
    align = "center",
    alignOffset = 0,
    children,
    ...props
}: TooltipPrimitive.Popup.Props &
    Pick<
        TooltipPrimitive.Positioner.Props,
        "align" | "alignOffset" | "side" | "sideOffset"
    >) {
    return (
        <TooltipPrimitive.Portal>
            <TooltipPrimitive.Positioner
                align={align}
                alignOffset={alignOffset}
                side={side}
                sideOffset={sideOffset}
                className="isolate z-50"
            >
                <TooltipPrimitive.Popup
                    data-slot="tooltip-content"
                    className={cn(
                        "z-50 inline-flex w-fit max-w-xs origin-(--transform-origin) items-center gap-1.5 rounded-md bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 has-data-[slot=kbd]:pr-1.5 data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 **:data-[slot=kbd]:relative **:data-[slot=kbd]:isolate **:data-[slot=kbd]:z-50 **:data-[slot=kbd]:rounded-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
                        className,
                    )}
                    {...props}
                >
                    {children}
                    {/* Barn av popupen, så den tones ut sammen med den. Som
                    søsken ble pilen stående igjen etter at boksen var borte. */}
                    <TooltipPrimitive.Arrow className={ARROW_CLASSES} />
                </TooltipPrimitive.Popup>
            </TooltipPrimitive.Positioner>
        </TooltipPrimitive.Portal>
    );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
