import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "#/lib/utils";

/**
 * `size="lg"`: a whole screen saying what happens next — big enough to read
 * at arm's length, late at night.
 */
function Empty({
    className,
    size = "default",
    ...props
}: React.ComponentProps<"div"> & { size?: "default" | "lg" }) {
    return (
        <div
            data-slot="empty"
            data-size={size}
            className={cn(
                "group/empty flex w-full min-w-0 flex-1 flex-col items-center justify-center gap-4 rounded-xl border-dashed p-6 text-center text-balance",
                className,
            )}
            {...props}
        />
    );
}

function EmptyHeader({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="empty-header"
            className={cn(
                "flex max-w-sm flex-col items-center gap-2",
                className,
            )}
            {...props}
        />
    );
}

const emptyMediaVariants = cva(
    "mb-2 flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0",
    {
        variants: {
            variant: {
                default: "bg-transparent",
                icon: "flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground [&_svg:not([class*='size-'])]:size-4",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    },
);

function EmptyMedia({
    className,
    variant = "default",
    ...props
}: React.ComponentProps<"div"> & VariantProps<typeof emptyMediaVariants>) {
    return (
        <div
            data-slot="empty-icon"
            data-variant={variant}
            className={cn(emptyMediaVariants({ variant, className }))}
            {...props}
        />
    );
}

function EmptyTitle({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="empty-title"
            className={cn(
                "font-heading text-sm font-medium tracking-tight group-data-[size=lg]/empty:text-[2rem]/tight group-data-[size=lg]/empty:font-bold",
                className,
            )}
            {...props}
        />
    );
}

function EmptyDescription({ className, ...props }: React.ComponentProps<"p">) {
    return (
        <div
            data-slot="empty-description"
            className={cn(
                "text-sm/relaxed text-muted-foreground group-data-[size=lg]/empty:text-lg/relaxed [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-link",
                className,
            )}
            {...props}
        />
    );
}

function EmptyContent({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="empty-content"
            className={cn(
                "flex w-full max-w-sm min-w-0 flex-col items-center gap-2.5 text-sm text-balance group-data-[size=lg]/empty:gap-4 group-data-[size=lg]/empty:text-base",
                className,
            )}
            {...props}
        />
    );
}

export {
    Empty,
    EmptyHeader,
    EmptyTitle,
    EmptyDescription,
    EmptyContent,
    EmptyMedia,
};
