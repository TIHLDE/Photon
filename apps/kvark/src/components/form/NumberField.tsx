import { useFieldContext, useFieldErrorVisible } from "#/hooks/form";
import { cn } from "#/lib/utils";
import {
    Field,
    FieldDescription,
    FieldError,
    FieldLabel,
} from "@tihlde/ui/ui/field";
import {
    NumberField as NumberFieldRoot,
    NumberFieldDecrement,
    NumberFieldGroup,
    NumberFieldIncrement,
    NumberFieldInput,
} from "@tihlde/ui/ui/number-field";
import { useId } from "react";

interface BasicFieldPropBase {
    label?: string;
    required?: boolean;
    description?: string;
    hideError?: boolean;
}

interface NumberFieldProps
    extends
        BasicFieldPropBase,
        Omit<
            React.ComponentProps<typeof NumberFieldRoot>,
            "id" | "name" | "value" | "onValueChange"
        > {
    placeholder?: string;
    className?: string;
}

export function NumberField({
    label,
    required,
    description,
    hideError = false,
    placeholder,
    className,
    min,
    max,
    step,
    ...rootProps
}: NumberFieldProps) {
    const field = useFieldContext<number | null>();
    const inputId = useId();
    const isInvalid = useFieldErrorVisible();

    return (
        <Field data-invalid={isInvalid}>
            {label && (
                <FieldLabel htmlFor={inputId}>
                    {label}{" "}
                    {required && <span className="text-destructive">*</span>}
                </FieldLabel>
            )}
            <NumberFieldRoot
                {...rootProps}
                id={inputId}
                name={field.name}
                required={required}
                min={min}
                max={max}
                step={step}
                value={field.state.value}
                onValueChange={(next) => field.handleChange(next)}
            >
                <NumberFieldGroup className={cn("w-32", className)}>
                    <NumberFieldDecrement />
                    <NumberFieldInput
                        placeholder={placeholder}
                        onBlur={field.handleBlur}
                        aria-invalid={isInvalid}
                    />
                    <NumberFieldIncrement />
                </NumberFieldGroup>
            </NumberFieldRoot>
            {description && <FieldDescription>{description}</FieldDescription>}
            {!hideError && isInvalid && (
                <FieldError errors={field.state.meta.errors} />
            )}
        </Field>
    );
}
