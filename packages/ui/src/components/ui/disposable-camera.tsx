import type * as React from "react";

import { cn } from "#/lib/utils";

type DisposableCameraProps = Omit<React.ComponentProps<"svg">, "children"> & {
    /** Shown in the counter window, like the frame counter on a real one. */
    shotsLeft: number;
};

/**
 * A drawn disposable camera with the shots left in its counter window.
 *
 * Drawn from theme tokens only, so it follows light and dark theme and the
 * brand colour without an image per theme. It has no motion of its own.
 */
function DisposableCamera({
    shotsLeft,
    className,
    ...props
}: DisposableCameraProps) {
    const label = `Engangskamera med ${shotsLeft} ${shotsLeft === 1 ? "bilde" : "bilder"} igjen`;

    return (
        <svg
            data-slot="disposable-camera"
            viewBox="0 0 240 156"
            role="img"
            aria-label={label}
            className={cn("block h-auto w-full", className)}
            {...props}
        >
            {/* Shutter button and film winder on top of the body. */}
            <rect
                x="34"
                y="10"
                width="30"
                height="14"
                rx="4"
                className="fill-foreground/70"
            />
            <rect
                x="152"
                y="6"
                width="56"
                height="18"
                rx="5"
                className="fill-primary/80"
            />

            {/* Body. */}
            <rect
                x="8"
                y="20"
                width="224"
                height="128"
                rx="18"
                className="fill-primary"
            />
            {/* The wrapper band across the front. */}
            <rect
                x="8"
                y="104"
                width="224"
                height="22"
                className="fill-primary-foreground/15"
            />

            {/* Flash. */}
            <rect
                x="24"
                y="36"
                width="56"
                height="30"
                rx="5"
                className="fill-primary-foreground/90"
            />
            <rect
                x="30"
                y="42"
                width="44"
                height="18"
                rx="3"
                className="fill-muted"
            />

            {/* Viewfinder. */}
            <rect
                x="170"
                y="36"
                width="44"
                height="26"
                rx="5"
                className="fill-foreground/85 dark:fill-background/85"
            />
            <rect
                x="176"
                y="41"
                width="14"
                height="8"
                rx="2"
                className="fill-white/40"
            />

            {/* Lens. */}
            {/* Dark in both themes, like glass: `foreground` is light in
             * dark mode, so it swaps to `background` there. */}
            <circle
                cx="120"
                cy="82"
                r="38"
                className="fill-foreground dark:fill-background"
            />
            <circle cx="120" cy="82" r="27" className="fill-muted-foreground" />
            <circle
                cx="120"
                cy="82"
                r="15"
                className="fill-foreground dark:fill-background"
            />
            <circle cx="111" cy="73" r="5" className="fill-white/50" />

            {/* Counter window. */}
            <rect
                x="168"
                y="70"
                width="48"
                height="34"
                rx="6"
                className="fill-background"
            />
            <text
                x="192"
                y="88"
                textAnchor="middle"
                dominantBaseline="central"
                className="fill-foreground font-mono text-[26px] font-bold tabular-nums"
                aria-hidden
            >
                {shotsLeft}
            </text>
        </svg>
    );
}

export { DisposableCamera };
