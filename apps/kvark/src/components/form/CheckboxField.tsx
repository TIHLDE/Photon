import { useFieldContext, useFieldErrorVisible } from "#/hooks/form";
import { Checkbox } from "@tihlde/ui/ui/checkbox";
import {
    Field,
    FieldContent,
    FieldDescription,
    FieldError,
    FieldLabel,
} from "@tihlde/ui/ui/field";
import { useId } from "react";

interface BasicFieldPropBase {
    label?: string;
    required?: boolean;
    description?: string;
    hideError?: boolean;
}

interface CheckboxFieldProps
    extends
        BasicFieldPropBase,
        Omit<
            React.ComponentProps<typeof Checkbox>,
            "checked" | "onCheckedChange" | "onBlur"
        > {}

export function CheckboxField({
    label,
    required,
    description,
    hideError = false,
    ...props
}: CheckboxFieldProps) {
    const field = useFieldContext<boolean>();
    const inputId = useId();
    const isInvalid = useFieldErrorVisible();

    return (
        <Field orientation="horizontal" data-invalid={isInvalid}>
            <FieldContent>
                {label && (
                    <FieldLabel htmlFor={inputId}>
                        {label}{" "}
                        {required && (
                            <span className="text-destructive">*</span>
                        )}
                    </FieldLabel>
                )}
                {description && !isInvalid && (
                    <FieldDescription>{description}</FieldDescription>
                )}
                {!hideError && isInvalid && (
                    <FieldError errors={field.state.meta.errors} />
                )}
            </FieldContent>
            <Checkbox
                {...props}
                id={inputId}
                name={field.name}
                required={required}
                checked={field.state.value}
                onCheckedChange={(checked) =>
                    field.handleChange(checked === true)
                }
                onBlur={field.handleBlur}
                aria-invalid={isInvalid}
            />
        </Field>
    );
}
