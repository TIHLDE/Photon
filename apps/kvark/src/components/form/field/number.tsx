import { useFieldContext } from "#/hooks/form";
import { cn } from "#/lib/utils";
import {
    NumberField as NumberFieldRoot,
    NumberFieldDecrement,
    NumberFieldGroup,
    NumberFieldIncrement,
    NumberFieldInput,
} from "@tihlde/ui/ui/number-field";
import { useField } from "./field";

interface NumberProps extends Omit<
    React.ComponentProps<typeof NumberFieldRoot>,
    "id" | "name" | "value" | "onValueChange" | "required"
> {
    placeholder?: string;
    className?: string;
}

export function Number({
    placeholder,
    className,
    min,
    max,
    step,
    ...rootProps
}: NumberProps) {
    const field = useFieldContext<number | null>();
    const ctx = useField();

    return (
        <NumberFieldRoot
            {...rootProps}
            id={ctx.inputId}
            name={field.name}
            required={ctx.required}
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
                    aria-invalid={ctx.isInvalid}
                />
                <NumberFieldIncrement />
            </NumberFieldGroup>
        </NumberFieldRoot>
    );
}
