import { useFieldContext } from "#/hooks/form";
import { Label as LabelPrimitive } from "@tihlde/ui/ui/label";
import {
    RadioGroup as RadioGroupRoot,
    RadioGroupItem,
} from "@tihlde/ui/ui/radio-group";
import { useField } from "./field";

interface RadioGroupOption<TValue extends string = string> {
    value: TValue;
    label: string;
}

interface RadioGroupProps<TValue extends string = string> {
    options: RadioGroupOption<TValue>[];
    disabled?: boolean;
}

export function RadioGroup<TValue extends string = string>({
    options,
    disabled,
}: RadioGroupProps<TValue>) {
    const field = useFieldContext<TValue>();
    const ctx = useField();

    return (
        <RadioGroupRoot
            name={field.name}
            value={field.state.value}
            onValueChange={(next) => field.handleChange(next as TValue)}
            onBlur={field.handleBlur}
            aria-invalid={ctx.isInvalid}
            aria-labelledby={`${ctx.inputId}-label`}
            disabled={disabled}
        >
            {options.map((option) => {
                const itemId = `${ctx.inputId}-${option.value}`;
                return (
                    <LabelPrimitive
                        key={option.value}
                        htmlFor={itemId}
                        className="font-normal"
                    >
                        <RadioGroupItem id={itemId} value={option.value} />
                        {option.label}
                    </LabelPrimitive>
                );
            })}
        </RadioGroupRoot>
    );
}
