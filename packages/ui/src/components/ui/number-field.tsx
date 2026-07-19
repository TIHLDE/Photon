"use client";

import { NumberField as NumberFieldPrimitive } from "@base-ui/react/number-field";
import { MinusIcon, PlusIcon } from "lucide-react";

import { cn } from "#/lib/utils";
import { InputGroupButton } from "#/components/ui/input-group";

function NumberField(props: NumberFieldPrimitive.Root.Props) {
    return <NumberFieldPrimitive.Root data-slot="number-field" {...props} />;
}

function NumberFieldGroup({
    className,
    ...props
}: NumberFieldPrimitive.Group.Props) {
    return (
        <NumberFieldPrimitive.Group
            data-slot="number-field-group"
            className={cn(
                "flex h-8 w-full min-w-0 items-center rounded-lg border border-input bg-transparent transition-colors outline-none has-disabled:bg-input/50 has-disabled:opacity-50 has-[[data-slot=number-field-input]:focus-visible]:border-ring has-[[data-slot=number-field-input]:focus-visible]:ring-3 has-[[data-slot=number-field-input]:focus-visible]:ring-ring/50 has-[[data-slot=number-field-input][aria-invalid=true]]:border-destructive has-[[data-slot=number-field-input][aria-invalid=true]]:ring-3 has-[[data-slot=number-field-input][aria-invalid=true]]:ring-destructive/20 dark:bg-input/30 dark:has-disabled:bg-input/80 dark:has-[[data-slot=number-field-input][aria-invalid=true]]:border-destructive/50 dark:has-[[data-slot=number-field-input][aria-invalid=true]]:ring-destructive/40",
                className,
            )}
            {...props}
        />
    );
}

function NumberFieldInput({
    className,
    ...props
}: NumberFieldPrimitive.Input.Props) {
    return (
        <NumberFieldPrimitive.Input
            data-slot="number-field-input"
            className={cn(
                "min-w-0 flex-1 bg-transparent text-center text-base tabular-nums outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed md:text-sm",
                className,
            )}
            {...props}
        />
    );
}

function NumberFieldDecrement({
    className,
    children,
    ...props
}: NumberFieldPrimitive.Decrement.Props) {
    return (
        <NumberFieldPrimitive.Decrement
            data-slot="number-field-decrement"
            aria-label="Decrease"
            render={<InputGroupButton variant="ghost" size="icon-sm" />}
            className={cn(
                "rounded-r-none rounded-l-[calc(var(--radius)-1px)]",
                className,
            )}
            {...props}
        >
            {children ?? <MinusIcon />}
        </NumberFieldPrimitive.Decrement>
    );
}

function NumberFieldIncrement({
    className,
    children,
    ...props
}: NumberFieldPrimitive.Increment.Props) {
    return (
        <NumberFieldPrimitive.Increment
            data-slot="number-field-increment"
            aria-label="Increase"
            render={<InputGroupButton variant="ghost" size="icon-sm" />}
            className={cn(
                "rounded-l-none rounded-r-[calc(var(--radius)-1px)]",
                className,
            )}
            {...props}
        >
            {children ?? <PlusIcon />}
        </NumberFieldPrimitive.Increment>
    );
}

export {
    NumberField,
    NumberFieldGroup,
    NumberFieldInput,
    NumberFieldDecrement,
    NumberFieldIncrement,
};
