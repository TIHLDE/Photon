import { useFieldContext, useFieldErrorVisible } from "#/hooks/form";
import {
    Field,
    FieldDescription,
    FieldError,
    FieldLabel,
} from "@tihlde/ui/ui/field";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@tihlde/ui/ui/select";
import { useId } from "react";

interface BasicFieldPropBase {
    label?: string;
    required?: boolean;
    description?: string;
    hideError?: boolean;
}

interface SelectFieldOption<TValue extends string = string> {
    value: TValue;
    label: string;
}

interface SelectFieldProps<
    TValue extends string = string,
> extends BasicFieldPropBase {
    options: SelectFieldOption<TValue>[];
    placeholder?: string;
    disabled?: boolean;
}

export function SelectField<TValue extends string = string>({
    label,
    required,
    description,
    hideError = false,
    options,
    placeholder,
    disabled,
}: SelectFieldProps<TValue>) {
    const field = useFieldContext<TValue>();
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
            <Select
                value={field.state.value}
                onValueChange={(next) => field.handleChange(next as TValue)}
                onOpenChange={(open) => {
                    if (!open) field.handleBlur();
                }}
                disabled={disabled}
            >
                <SelectTrigger
                    id={inputId}
                    name={field.name}
                    aria-invalid={isInvalid}
                    className="w-full"
                >
                    <SelectValue placeholder={placeholder} />
                </SelectTrigger>
                <SelectContent>
                    {options.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                            {option.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {description && <FieldDescription>{description}</FieldDescription>}
            {!hideError && isInvalid && (
                <FieldError errors={field.state.meta.errors} />
            )}
        </Field>
    );
}
