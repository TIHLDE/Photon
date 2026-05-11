import { useFieldContext } from "#/hooks/form";
import {
    Select as SelectRoot,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@tihlde/ui/ui/select";
import { useField } from "./field";

interface SelectOption<TValue extends string = string> {
    value: TValue;
    label: string;
}

interface SelectProps<TValue extends string = string> {
    options: SelectOption<TValue>[];
    placeholder?: string;
    disabled?: boolean;
}

export function Select<TValue extends string = string>({
    options,
    placeholder,
    disabled,
}: SelectProps<TValue>) {
    const field = useFieldContext<TValue>();
    const ctx = useField();

    return (
        <SelectRoot
            value={field.state.value}
            onValueChange={(next) => field.handleChange(next as TValue)}
            onOpenChange={(open) => {
                if (!open) field.handleBlur();
            }}
            disabled={disabled}
        >
            <SelectTrigger
                id={ctx.inputId}
                name={field.name}
                aria-invalid={ctx.isInvalid}
                className="w-full"
            >
                <SelectValue placeholder={placeholder}>
                    {(value) => {
                        const opt = options.find((o) => o.value === value);
                        if (opt) return opt.label;
                        return placeholder ?? null;
                    }}
                </SelectValue>
            </SelectTrigger>
            <SelectContent>
                {options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                        {option.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </SelectRoot>
    );
}
