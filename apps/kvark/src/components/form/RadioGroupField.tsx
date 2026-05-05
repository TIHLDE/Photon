import { useFieldContext, useFieldErrorVisible } from "#/hooks/form";
import {
    Field,
    FieldDescription,
    FieldError,
    FieldLabel,
} from "@tihlde/ui/ui/field";
import { Label } from "@tihlde/ui/ui/label";
import { RadioGroup, RadioGroupItem } from "@tihlde/ui/ui/radio-group";
import { useId } from "react";

interface BasicFieldPropBase {
    label?: string;
    required?: boolean;
    description?: string;
    hideError?: boolean;
}

interface RadioGroupFieldOption<TValue extends string = string> {
    value: TValue;
    label: string;
}

interface RadioGroupFieldProps<
    TValue extends string = string,
> extends BasicFieldPropBase {
    options: RadioGroupFieldOption<TValue>[];
    disabled?: boolean;
}

export function RadioGroupField<TValue extends string = string>({
    label,
    required,
    description,
    hideError = false,
    options,
    disabled,
}: RadioGroupFieldProps<TValue>) {
    const field = useFieldContext<TValue>();
    const groupId = useId();
    const isInvalid = useFieldErrorVisible();

    return (
        <Field data-invalid={isInvalid}>
            {label && (
                <FieldLabel id={`${groupId}-label`}>
                    {label}{" "}
                    {required && <span className="text-destructive">*</span>}
                </FieldLabel>
            )}
            <RadioGroup
                name={field.name}
                value={field.state.value}
                onValueChange={(next) => field.handleChange(next as TValue)}
                onBlur={field.handleBlur}
                aria-invalid={isInvalid}
                aria-labelledby={label ? `${groupId}-label` : undefined}
                disabled={disabled}
            >
                {options.map((option) => {
                    const itemId = `${groupId}-${option.value}`;
                    return (
                        <Label
                            key={option.value}
                            htmlFor={itemId}
                            className="font-normal"
                        >
                            <RadioGroupItem id={itemId} value={option.value} />
                            {option.label}
                        </Label>
                    );
                })}
            </RadioGroup>
            {description && <FieldDescription>{description}</FieldDescription>}
            {!hideError && isInvalid && (
                <FieldError errors={field.state.meta.errors} />
            )}
        </Field>
    );
}
