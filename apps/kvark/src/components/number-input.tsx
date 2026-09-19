import {
    NumberField,
    NumberFieldDecrement,
    NumberFieldGroup,
    NumberFieldIncrement,
    NumberFieldInput,
} from "@tihlde/ui/ui/number-field";
import { cn } from "#/lib/utils";

type NumberInputProps = {
    id?: string;
    value: string;
    onValueChange: (value: string) => void;
    min?: number;
    max?: number;
    step?: number;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
};

export function NumberInput({
    id,
    value,
    onValueChange,
    min,
    max,
    step,
    placeholder,
    disabled,
    className,
}: NumberInputProps) {
    const parsed = value.trim() === "" ? Number.NaN : Number(value);

    return (
        <NumberField
            id={id}
            min={min}
            max={max}
            step={step}
            disabled={disabled}
            value={Number.isFinite(parsed) ? parsed : null}
            onValueChange={(next) =>
                onValueChange(next === null ? "" : String(next))
            }
        >
            <NumberFieldGroup className={cn(className)}>
                <NumberFieldDecrement />
                <NumberFieldInput placeholder={placeholder} />
                <NumberFieldIncrement />
            </NumberFieldGroup>
        </NumberField>
    );
}
