import { useFieldContext, useFieldErrorVisible } from "#/hooks/form";
import { Checkbox } from "@tihlde/ui/ui/checkbox";
import {
    Field,
    FieldDescription,
    FieldError,
    FieldLabel,
} from "@tihlde/ui/ui/field";
import { Label } from "@tihlde/ui/ui/label";
import { useId } from "react";

interface BasicFieldPropBase {
    label?: string;
    required?: boolean;
    description?: string;
    hideError?: boolean;
}

interface CheckboxGroupFieldOption<TValue extends string | number> {
    value: TValue;
    label: string;
}

interface CheckboxGroupFieldProps<
    TValue extends string | number,
> extends BasicFieldPropBase {
    options: CheckboxGroupFieldOption<TValue>[];
    disabled?: boolean;
}

export function CheckboxGroupField<TValue extends string | number>({
    label,
    required,
    description,
    hideError = false,
    options,
    disabled,
}: CheckboxGroupFieldProps<TValue>) {
    const field = useFieldContext<TValue[]>();
    const groupId = useId();
    const isInvalid = useFieldErrorVisible();

    const toggle = (value: TValue, checked: boolean) => {
        const current = field.state.value;
        const next = checked
            ? [...current, value]
            : current.filter((v) => v !== value);
        field.handleChange(next);
    };

    return (
        <Field data-invalid={isInvalid}>
            {label && (
                <FieldLabel id={`${groupId}-label`}>
                    {label}{" "}
                    {required && <span className="text-destructive">*</span>}
                </FieldLabel>
            )}
            <div
                role="group"
                data-slot="checkbox-group"
                aria-labelledby={label ? `${groupId}-label` : undefined}
                aria-invalid={isInvalid}
                className="flex flex-col gap-2"
            >
                {options.map((option) => {
                    const itemId = `${groupId}-${String(option.value)}`;
                    return (
                        <Label
                            key={String(option.value)}
                            htmlFor={itemId}
                            className="font-normal"
                        >
                            <Checkbox
                                id={itemId}
                                disabled={disabled}
                                checked={field.state.value.includes(
                                    option.value,
                                )}
                                onCheckedChange={(checked) =>
                                    toggle(option.value, checked === true)
                                }
                            />
                            {option.label}
                        </Label>
                    );
                })}
            </div>
            {description && <FieldDescription>{description}</FieldDescription>}
            {!hideError && isInvalid && (
                <FieldError errors={field.state.meta.errors} />
            )}
        </Field>
    );
}
