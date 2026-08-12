import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import { isValidElement } from "react";

import { cn } from "#/lib/utils";

const buttonVariants = cva(
    // The press state pairs a 1px drop with a 0.97 scale: the nudge alone is
    // easy to miss, and the scale is what actually reads as "the button heard
    // you". Both are skipped on popup triggers (aria-haspopup) — those stay
    // visually pressed for as long as their menu is open, so animating the
    // press there fights the open state. `translate` and `scale` are separate
    // CSS properties in Tailwind v4, so the two compose instead of clobbering.
    "group/button inline-flex max-w-full shrink-0 cursor-pointer items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-[color,background-color,border-color,box-shadow,translate,scale] duration-150 outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px active:not-aria-[haspopup]:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    {
        variants: {
            variant: {
                default:
                    "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
                outline:
                    "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
                secondary:
                    "bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
                ghost: "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
                destructive:
                    "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
                link: "text-link underline-offset-4 hover:underline",
            },
            size: {
                default:
                    "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
                xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
                sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
                lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
                icon: "size-8",
                "icon-xs":
                    "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
                "icon-sm":
                    "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
                "icon-lg": "size-9",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    },
);

type ButtonProps = ButtonPrimitive.Props & VariantProps<typeof buttonVariants>;

function Button({
    className,
    variant = "default",
    size = "default",
    nativeButton,
    render,
    ...props
}: ButtonProps) {
    const classNames = cn(buttonVariants({ variant, size, className }));

    // Base UI is explicit that links "have their own semantics and should not
    // be rendered as buttons through the `render` prop": routed through
    // ButtonPrimitive they either warn (`nativeButton` defaults to true, and
    // the element turns out not to be a `<button>`) or get `role="button"`
    // slapped on, which hides the link from screen readers. So a link only
    // borrows the styling — the anchor keeps its own semantics.
    if (isLinkRender(render)) {
        return <ButtonLink {...props} className={classNames} render={render} />;
    }

    return (
        <ButtonPrimitive
            data-slot="button"
            className={classNames}
            render={render}
            // Any other non-`<button>` render element (a `<div>`, a `<span>`)
            // does want Base UI's button semantics — it just has to say so, or
            // Base UI warns. Infer it instead of asking every call site; an
            // explicit prop still wins, and a render *function* is opaque here
            // so it keeps the native default.
            nativeButton={nativeButton ?? isNativeButtonRender(render)}
            {...props}
        />
    );
}

function ButtonLink({
    className,
    render,
    ...props
}: Omit<ButtonProps, "nativeButton" | "variant" | "size" | "className"> & {
    className?: string;
}) {
    return useRender({
        defaultTagName: "a",
        render: render as useRender.ComponentProps<"a">["render"],
        props: mergeProps<"a">(
            { className },
            props as useRender.ComponentProps<"a">,
        ),
        state: { slot: "button" },
    });
}

function isLinkRender(render: ButtonProps["render"]) {
    if (!isValidElement<{ href?: unknown; to?: unknown }>(render)) {
        return false;
    }

    // `<a href>` and TanStack Router's `<Link to>` — the two ways this codebase
    // renders a button that navigates. A destination is what makes it a link:
    // an `<a>` without one is just a clickable element, and does want Base UI's
    // button semantics (`role="button"`, keyboard activation).
    return render.props.href !== undefined || render.props.to !== undefined;
}

function isNativeButtonRender(render: ButtonProps["render"]) {
    if (isValidElement(render)) {
        return render.type === "button";
    }

    return true;
}

export { Button, buttonVariants };
