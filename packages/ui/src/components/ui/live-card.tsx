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
 * `overlay` sits on the frame's bottom edge, for a {@link LiveCardAction}
 * that should take no room of its own. There is no scrim: the action is solid,
 * so it reads against any photo.
 */
function LiveCardMedia({
    className,
    children,
    overlay,
    ...props
}: React.ComponentProps<"div"> & { overlay?: React.ReactNode }) {
    return (
        <div
            data-slot="live-card-media"
            className={cn(
                "relative w-full overflow-hidden rounded-2xl bg-muted",
                IMAGE_PRESETS["cover-wide"].aspectClassName,
                className,
            )}
            {...props}
        >
            {children}
            {overlay ? (
                <div
                    data-slot="live-card-media-overlay"
                    className="absolute inset-x-0 bottom-0 p-3"
                >
                    {overlay}
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

export {
    LiveCard,
    LiveCardAction,
    LiveCardHeader,
    LiveCardImage,
    LiveCardIndicator,
    LiveCardMedia,
    LiveCardMeta,
    LiveCardTitle,
};
