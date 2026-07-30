"use client";

import { Separator as SeparatorPrimitive } from "@base-ui/react/separator";

import { cn } from "#/lib/utils";

type SeparatorProps = SeparatorPrimitive.Props & {
    /**
     * `subtle` demper linjen slik at den skiller seksjoner uten å trekke blikket.
     */
    variant?: "default" | "subtle";
};

function Separator({
    className,
    orientation = "horizontal",
    variant = "default",
    ...props
}: SeparatorProps) {
    return (
        <SeparatorPrimitive
            data-slot="separator"
            orientation={orientation}
            className={cn(
                "shrink-0 bg-border data-horizontal:h-px data-horizontal:w-full data-vertical:w-px data-vertical:self-stretch",
                variant === "subtle" && "bg-border-subtle",
                className,
            )}
            {...props}
        />
    );
}

export { Separator };
