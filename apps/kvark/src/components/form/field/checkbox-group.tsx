import { useFieldContext } from "#/hooks/form";
import { Checkbox as CheckboxPrimitive } from "@tihlde/ui/ui/checkbox";
import { Label as LabelPrimitive } from "@tihlde/ui/ui/label";
import { useField } from "./field";

interface CheckboxGroupOption<TValue extends string | number> {
    value: TValue;
    label: string;
}

interface CheckboxGroupProps<TValue extends string | number> {
    options: CheckboxGroupOption<TValue>[];
    disabled?: boolean;
}

export function CheckboxGroup<TValue extends string | number>({
    options,
    disabled,
}: CheckboxGroupProps<TValue>) {
    const field = useFieldContext<TValue[]>();
    const ctx = useField();

    const toggle = (value: TValue, checked: boolean) => {
        const current = field.state.value;
        const next = checked
            ? [...current, value]
            : current.filter((v) => v !== value);
        field.handleChange(next);
    };

    return (
        <div
            role="group"
            data-slot="checkbox-group"
            aria-labelledby={`${ctx.inputId}-label`}
            aria-invalid={ctx.isInvalid}
            className="flex flex-col gap-2"
        >
            {options.map((option) => {
                const itemId = `${ctx.inputId}-${String(option.value)}`;
                return (
                    <LabelPrimitive
                        key={String(option.value)}
                        htmlFor={itemId}
                        className="font-normal"
                    >
                        <CheckboxPrimitive
                            id={itemId}
                            disabled={disabled}
                            checked={field.state.value.includes(option.value)}
                            onCheckedChange={(checked) =>
                                toggle(option.value, checked === true)
                            }
                        />
                        {option.label}
                    </LabelPrimitive>
                );
            })}
        </div>
    );
}
