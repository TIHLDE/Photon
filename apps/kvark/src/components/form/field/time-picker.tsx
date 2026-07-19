import { useFieldContext } from "#/hooks/form";
import {
    TimePicker as TimePickerPrimitive,
    type TimeValue,
} from "@tihlde/ui/ui/time-picker";
import { useField } from "./field";

type TimePickerProps = Omit<
    React.ComponentProps<typeof TimePickerPrimitive>,
    "value" | "onValueChange" | "id" | "name" | "aria-invalid"
>;

export function TimePicker(props: TimePickerProps) {
    const field = useFieldContext<TimeValue | null>();
    const ctx = useField();

    return (
        <TimePickerPrimitive
            {...props}
            id={ctx.inputId}
            name={field.name}
            aria-invalid={ctx.isInvalid}
            value={field.state.value}
            onValueChange={(next) => {
                field.handleChange(next);
                field.handleBlur();
            }}
        />
    );
}
