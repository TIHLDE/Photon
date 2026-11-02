import { useRender } from "@base-ui/react/use-render";
import type * as React from "react";

import { IMAGE_PRESETS } from "#/components/ui/image-preset";
import { cn } from "#/lib/utils";

type LiveCardProps = React.ComponentProps<"div"> & {
    render?: useRender.RenderProp;
};

/**
 * A large card for something happening right now, with one obvious action.
 *
 * The whole card is meant to be one tap target: pass a link as `render` and
 * keep buttons out of it. {@link LiveCardAction} looks like a button but is
 * only the card's label for that action.
 */
function LiveCard({ className, render, ...props }: LiveCardProps) {
    return useRender({
        render: render ?? <div />,
        props: {
            "data-slot": "live-card",
            className: cn(
                "group/live-card flex flex-col gap-4 overflow-hidden rounded-3xl bg-card p-5 text-card-foreground ring-1 ring-card-border outline-none select-none transition-transform duration-150 focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100 sm:p-6",
                className,
            ),
            ...props,
        },
    });
}

function LiveCardHeader({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="live-card-header"
            className={cn(
                "flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm",
                className,
            )}
            {...props}
        />
    );
}

/** A pulsing dot and a short label, e.g. «Pågår nå». */
function LiveCardIndicator({
    className,
    children,
    ...props
}: React.ComponentProps<"span">) {
    return (
        <span
            data-slot="live-card-indicator"
            className={cn(
                "inline-flex items-center gap-2 font-semibold tracking-wide uppercase",
                className,
            )}
            {...props}
        >
            <span className="relative flex size-2.5" aria-hidden>
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-destructive/70 motion-reduce:animate-none" />
                <span className="relative inline-flex size-2.5 rounded-full bg-destructive" />
            </span>
            {children}
        </span>
    );
}

function LiveCardMeta({ className, ...props }: React.ComponentProps<"span">) {
    return (
        <span
            data-slot="live-card-meta"
            className={cn("text-muted-foreground tabular-nums", className)}
            {...props}
        />
    );
}

function LiveCardTitle({ className, ...props }: React.ComponentProps<"h2">) {
    return (
        <h2
            data-slot="live-card-title"
            className={cn(
                "text-3xl leading-tight font-bold text-balance break-words sm:text-4xl",
                className,
            )}
            {...props}
        />
    );
}

/**
 * A picture in the card: the event's banner, or a drawing in its place.
 * Children fill the frame (`absolute inset-0`). The frame is 21:9, the ratio
 * of `cover-wide`, so a banner shows across its whole width.
 *
 * `overlay` sits inside the frame in a corner (`overlayPosition`), for a
 * {@link LiveCardChip}. `edge` is centred on the frame's bottom edge, half
 * over the picture and half below it, for a {@link LiveCardShutter}; it lives
 * outside the clipped frame, and the media makes room for its lower half.
 * There is no scrim: both are solid, so they read against any photo.
 */
function LiveCardMedia({
    className,
    children,
    overlay,
    overlayPosition = "bottom-end",
    edge,
    ...props
}: React.ComponentProps<"div"> & {
    overlay?: React.ReactNode;
    overlayPosition?: "bottom-end" | "top-end";
    edge?: React.ReactNode;
}) {
    return (
        <div
            data-slot="live-card-media"
            className={cn("relative w-full", edge && "mb-8", className)}
            {...props}
        >
            <div
                data-slot="live-card-media-frame"
                className={cn(
                    "relative w-full overflow-hidden rounded-2xl bg-muted",
                    IMAGE_PRESETS["cover-wide"].aspectClassName,
                )}
            >
                {children}
                {overlay ? (
                    <div
                        data-slot="live-card-media-overlay"
                        className={cn(
                            "absolute right-3",
                            overlayPosition === "top-end"
                                ? "top-3"
                                : "bottom-3",
                        )}
                    >
                        {overlay}
                    </div>
                ) : null}
            </div>
            {edge ? (
                <div
                    data-slot="live-card-media-edge"
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2"
                >
                    {edge}
                </div>
            ) : null}
        </div>
    );
}

/**
 * The banner photo, cropped to fill {@link LiveCardMedia} without distortion.
 * `alt` is required: pass "" when the card's label already says it all.
 */
function LiveCardImage({
    className,
    alt,
    ...props
}: React.ComponentProps<"img"> & { alt: string }) {
    return (
        <img
            data-slot="live-card-image"
            alt={alt}
            className={cn("absolute inset-0 size-full object-cover", className)}
            {...props}
        />
    );
}

/**
 * The card's call to action, drawn as a large button across its foot.
 * `warning` when something is lost unless the member acts soon.
 */
function LiveCardAction({
    className,
    variant = "default",
    ...props
}: React.ComponentProps<"span"> & { variant?: "default" | "warning" }) {
    return (
        <span
            data-slot="live-card-action"
            data-variant={variant}
            className={cn(
                "flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl bg-primary px-4 text-lg font-semibold text-primary-foreground transition-opacity duration-100 group-active/live-card:opacity-90 motion-reduce:transition-none [&_svg]:size-6 [&_svg]:shrink-0",
                // Mørk tekst på gult i begge temaer, som varselet i bunnlinja.
                variant === "warning" && "bg-warning text-neutral-950",
                className,
            )}
            {...props}
        />
    );
}

/**
 * A round, button-looking disc for {@link LiveCardMedia}'s `edge`: an icon over
 * a short number, e.g. a camera and the shots left. Purely visual and hidden
 * from assistive tech, since the card link's label already says it.
 */
function LiveCardShutter({
    className,
    ...props
}: React.ComponentProps<"span">) {
    return (
        <span
            data-slot="live-card-shutter"
            aria-hidden
            className={cn(
                "flex size-16 flex-col items-center justify-center gap-0.5 rounded-full bg-primary text-xs font-semibold text-primary-foreground tabular-nums ring-4 ring-card transition-opacity duration-100 group-active/live-card:opacity-90 motion-reduce:transition-none [&_svg]:size-6 [&_svg]:shrink-0",
                className,
            )}
            {...props}
        />
    );
}

/**
 * A compact pill for a corner of {@link LiveCardMedia} (`overlay`): an icon and
 * a few words. `card` is solid card colours, readable on any photo. Purely
 * visual and hidden from assistive tech, like {@link LiveCardShutter}.
 */
function LiveCardChip({
    className,
    variant = "primary",
    ...props
}: React.ComponentProps<"span"> & { variant?: "primary" | "card" }) {
    return (
        <span
            data-slot="live-card-chip"
            data-variant={variant}
            aria-hidden
            className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium whitespace-nowrap shadow-sm [&_svg]:size-4 [&_svg]:shrink-0",
                variant === "card"
                    ? "bg-card text-card-foreground"
                    : "bg-primary text-primary-foreground",
                className,
            )}
            {...props}
        />
    );
}

export {
    LiveCard,
    LiveCardAction,
    LiveCardChip,
    LiveCardHeader,
    LiveCardImage,
    LiveCardIndicator,
    LiveCardMedia,
    LiveCardMeta,
    LiveCardShutter,
    LiveCardTitle,
};
