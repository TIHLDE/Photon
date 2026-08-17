import { Progress as ProgressPrimitive } from "@base-ui/react/progress";

import { cn } from "#/lib/utils";

/**
 * Prosenten som leses opp, formatert likt på server og klient.
 *
 * Uten dette formaterer Base UI den med `Intl.NumberFormat` og standardlokalet
 * på hver side: serveren skriver «40%», nettleseren «40 %» (med hardt
 * mellomrom), og React kastet en hydration-feil på `aria-valuetext` for hver
 * framdriftslinje på sida.
 */
function progressAriaValueText(
    _formattedValue: string | null,
    value: number | null,
) {
    return value === null ? "" : `${value} %`;
}

function Progress({
    className,
    children,
    value,
    ...props
}: ProgressPrimitive.Root.Props) {
    return (
        <ProgressPrimitive.Root
            value={value}
            getAriaValueText={progressAriaValueText}
            data-slot="progress"
            className={cn("flex flex-wrap gap-3", className)}
            {...props}
        >
            {children}
            <ProgressTrack>
                <ProgressIndicator />
            </ProgressTrack>
        </ProgressPrimitive.Root>
    );
}

function ProgressTrack({ className, ...props }: ProgressPrimitive.Track.Props) {
    return (
        <ProgressPrimitive.Track
            className={cn(
                "relative flex h-1 w-full items-center overflow-x-hidden rounded-full bg-muted",
                className,
            )}
            data-slot="progress-track"
            {...props}
        />
    );
}

function ProgressIndicator({
    className,
    ...props
}: ProgressPrimitive.Indicator.Props) {
    return (
        <ProgressPrimitive.Indicator
            data-slot="progress-indicator"
            className={cn(
                "h-full bg-primary transition-[width,transform,translate]",
                className,
            )}
            {...props}
        />
    );
}

function ProgressLabel({ className, ...props }: ProgressPrimitive.Label.Props) {
    return (
        <ProgressPrimitive.Label
            className={cn("min-w-0 text-sm font-medium", className)}
            data-slot="progress-label"
            {...props}
        />
    );
}

function ProgressValue({ className, ...props }: ProgressPrimitive.Value.Props) {
    return (
        <ProgressPrimitive.Value
            className={cn(
                "ml-auto text-sm text-muted-foreground tabular-nums",
                className,
            )}
            data-slot="progress-value"
            {...props}
        />
    );
}

export {
    Progress,
    ProgressTrack,
    ProgressIndicator,
    ProgressLabel,
    ProgressValue,
};
