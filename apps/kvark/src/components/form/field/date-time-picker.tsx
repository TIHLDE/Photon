import { useFieldContext } from "#/hooks/form";
import { DateTimePicker as DateTimePickerPrimitive } from "@tihlde/ui/ui/date-time-picker";
import { useField } from "./field";

type DateTimePickerWrapperProps = Omit<
    React.ComponentProps<typeof DateTimePickerPrimitive>,
    "value" | "onValueChange" | "id" | "name" | "aria-invalid"
>;

export function DateTimePicker(props: DateTimePickerWrapperProps) {
    const field = useFieldContext<Date | null>();
    const ctx = useField();

    return (
        <DateTimePickerPrimitive
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
