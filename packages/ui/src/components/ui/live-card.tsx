import { useRender } from "@base-ui/react/use-render";
import type * as React from "react";

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

/** The card's call to action, drawn as a large button across its foot. */
function LiveCardAction({ className, ...props }: React.ComponentProps<"span">) {
    return (
        <span
            data-slot="live-card-action"
            className={cn(
                "flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl bg-primary px-4 text-lg font-semibold text-primary-foreground transition-opacity duration-100 group-active/live-card:opacity-90 motion-reduce:transition-none [&_svg]:size-6 [&_svg]:shrink-0",
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
    LiveCardIndicator,
    LiveCardMeta,
    LiveCardTitle,
};
