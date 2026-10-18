import { useRender } from "@base-ui/react/use-render";
import * as React from "react";

import { cn } from "#/lib/utils";

type CardProps = React.ComponentProps<"div"> & {
    size?: "default" | "sm";
    /** Toned down, for something that is still there but no longer active. */
    muted?: boolean;
    render?: useRender.RenderProp;
    selected?: boolean;
    highlightOnGroupHover?: boolean;
};

function Card({
    className,
    size = "default",
    muted = false,
    render,
    selected,
    highlightOnGroupHover = false,
    ...props
}: CardProps) {
    return useRender({
        render: render ?? <div />,
        props: {
            "data-slot": "card",
            "data-size": size,
            "data-muted": muted ? "" : undefined,
            className: cn(
                // `card-media` gets the same flush-to-the-edge treatment as a
                // bare `img`, so a cover and its placeholder line up instead of
                // the placeholder sitting inset below a strip of card.
                "group/card flex flex-col gap-4 overflow-hidden rounded-xl bg-card py-4 text-sm text-card-foreground ring-1 ring-card-border has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 has-[>[data-slot=card-media]:first-child]:pt-0 data-muted:bg-muted/40 data-muted:*:opacity-70 data-[size=sm]:gap-3 data-[size=sm]:py-3 data-muted:[&_img]:grayscale data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl *:[[data-slot=card-media]:first-child]:rounded-t-xl *:[[data-slot=card-media]:last-child]:rounded-b-xl",
                selected !== undefined && "transition-colors",
                selected === true && "bg-primary/10 ring-primary",
                selected === false && "hover:ring-foreground/20",
                highlightOnGroupHover &&
                    "transition-colors group-hover:bg-muted",
                className,
            ),
            ...props,
        },
    });
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="card-header"
            className={cn(
                "group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-xl px-4 group-data-[size=sm]/card:px-3 has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-4 group-data-[size=sm]/card:[.border-b]:pb-3",
                className,
            )}
            {...props}
        />
    );
}

const CARD_TITLE_TEXT_SIZES = {
    xl: "text-xl",
    "2xl": "text-2xl",
} as const;

function CardTitle({
    className,
    textSize,
    ...props
}: React.ComponentProps<"div"> & {
    textSize?: keyof typeof CARD_TITLE_TEXT_SIZES;
}) {
    return (
        <div
            data-slot="card-title"
            className={cn(
                "min-w-0 font-heading text-base leading-snug font-medium group-data-[size=sm]/card:text-sm",
                textSize && CARD_TITLE_TEXT_SIZES[textSize],
                className,
            )}
            {...props}
        />
    );
}

function CardDescription({
    className,
    truncate = false,
    lineClamp,
    ...props
}: React.ComponentProps<"div"> & { truncate?: boolean; lineClamp?: 2 }) {
    return (
        <div
            data-slot="card-description"
            className={cn(
                "text-sm text-muted-foreground",
                truncate && "truncate",
                lineClamp === 2 && "line-clamp-2",
                className,
            )}
            {...props}
        />
    );
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="card-action"
            className={cn(
                "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
                className,
            )}
            {...props}
        />
    );
}

function CardContent({
    className,
    textSize,
    ...props
}: React.ComponentProps<"div"> & { textSize?: "sm" }) {
    return (
        <div
            data-slot="card-content"
            className={cn(
                "px-4 group-data-[size=sm]/card:px-3",
                textSize === "sm" && "text-sm",
                className,
            )}
            {...props}
        />
    );
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="card-footer"
            className={cn(
                "flex items-center rounded-b-xl border-t bg-muted/50 p-4 group-data-[size=sm]/card:p-3",
                className,
            )}
            {...props}
        />
    );
}

export {
    Card,
    CardHeader,
    CardFooter,
    CardTitle,
    CardAction,
    CardDescription,
    CardContent,
};
