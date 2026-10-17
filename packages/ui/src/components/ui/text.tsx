import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "#/lib/utils";

const textVariants = cva("", {
    variants: {
        size: {
            xs: "text-xs",
            sm: "text-sm",
            base: "text-base",
            lg: "text-lg",
            xl: "text-xl",
            "2xl": "text-2xl",
            "3xl": "text-3xl",
            "4xl": "text-4xl",
        },
        tone: {
            foreground: "text-foreground",
            muted: "text-muted-foreground",
            destructive: "text-destructive",
        },
        weight: {
            normal: "font-normal",
            medium: "font-medium",
            semibold: "font-semibold",
            bold: "font-bold",
        },
    },
});

type TextProps = useRender.ComponentProps<"p"> &
    VariantProps<typeof textVariants>;

function Text({ className, size, tone, weight, render, ...props }: TextProps) {
    return useRender({
        defaultTagName: "p",
        render,
        props: {
            ...props,
            className: cn(textVariants({ size, tone, weight }), className),
        },
    });
}

export { Text, textVariants };
