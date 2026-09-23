import {
    NumberField,
    NumberFieldDecrement,
    NumberFieldGroup,
    NumberFieldIncrement,
    NumberFieldInput,
} from "@tihlde/ui/ui/number-field";

type NumberInputProps = {
    id?: string;
    value: string;
    onValueChange: (value: string) => void;
    min?: number;
    max?: number;
    step?: number | "any";
    format?: Intl.NumberFormatOptions;
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
    format,
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
            format={format}
            disabled={disabled}
            value={Number.isFinite(parsed) ? parsed : null}
            onValueChange={(next) =>
                onValueChange(next === null ? "" : String(next))
            }
        >
            <NumberFieldGroup className={className}>
                <NumberFieldDecrement />
                <NumberFieldInput placeholder={placeholder} />
                <NumberFieldIncrement />
            </NumberFieldGroup>
        </NumberField>
    );
}
