import { useFieldContext } from "#/hooks/form";
import {
    DatePicker as DatePickerPrimitive,
    DateRangePicker as DateRangePickerPrimitive,
    type DateRange,
} from "@tihlde/ui/ui/date-picker";
import { nb } from "date-fns/locale";
import { useField } from "./field";

type DatePickerWrapperProps = Omit<
    React.ComponentProps<typeof DatePickerPrimitive>,
    "value" | "onValueChange" | "id" | "name" | "aria-invalid"
>;

export function DatePicker({ locale = nb, ...props }: DatePickerWrapperProps) {
    const field = useFieldContext<Date | null>();
    const ctx = useField();

    return (
        <DatePickerPrimitive
            {...props}
            locale={locale}
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

type DateRangePickerWrapperProps = Omit<
    React.ComponentProps<typeof DateRangePickerPrimitive>,
    "value" | "onValueChange" | "id" | "name" | "aria-invalid"
>;

export function DateRangePicker({
    locale = nb,
    ...props
}: DateRangePickerWrapperProps) {
    const field = useFieldContext<DateRange | null>();
    const ctx = useField();

    return (
        <DateRangePickerPrimitive
            {...props}
            locale={locale}
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
