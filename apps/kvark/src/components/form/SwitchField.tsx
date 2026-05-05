import { useFieldContext, useFieldErrorVisible } from "#/hooks/form";
import {
    Field,
    FieldContent,
    FieldDescription,
    FieldError,
    FieldLabel,
} from "@tihlde/ui/ui/field";
import { Switch } from "@tihlde/ui/ui/switch";
import { useId } from "react";

interface BasicFieldPropBase {
    label?: string;
    required?: boolean;
    description?: string;
    hideError?: boolean;
}

interface SwitchFieldProps
    extends
        BasicFieldPropBase,
        Omit<
            React.ComponentProps<typeof Switch>,
            "checked" | "onCheckedChange" | "onBlur"
        > {}

export function SwitchField({
    label,
    required,
    description,
    hideError = false,
    ...props
}: SwitchFieldProps) {
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
                {description && (
                    <FieldDescription>{description}</FieldDescription>
                )}
                {!hideError && isInvalid && (
                    <FieldError errors={field.state.meta.errors} />
                )}
            </FieldContent>
            <Switch
                {...props}
                id={inputId}
                name={field.name}
                required={required}
                checked={field.state.value}
                onCheckedChange={(checked) => field.handleChange(checked)}
                onBlur={field.handleBlur}
                aria-invalid={isInvalid}
            />
        </Field>
    );
}
