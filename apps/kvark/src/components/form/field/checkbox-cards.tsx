import { useFieldContext } from "#/hooks/form";
import { Checkbox as CheckboxPrimitive } from "@tihlde/ui/ui/checkbox";
import {
    FieldContent,
    Field as FieldPrimitive,
    FieldLabel,
    FieldTitle,
} from "@tihlde/ui/ui/field";
import { useField } from "./field";

interface CheckboxCardsProps {
    options: { value: string; label: string }[];
}

/** A checkbox group where each option is a bordered card with a large click area. */
export function CheckboxCards({ options }: CheckboxCardsProps) {
    const field = useFieldContext<string[]>();
    const ctx = useField();

    const toggle = (value: string, checked: boolean) => {
        const current = field.state.value;
        field.handleChange(
            checked ? [...current, value] : current.filter((v) => v !== value),
        );
    };

    return (
        <div
            role="group"
            aria-labelledby={`${ctx.inputId}-label`}
            aria-invalid={ctx.isInvalid}
            className="grid gap-3 sm:grid-cols-2"
        >
            {options.map((option) => {
                const itemId = `${ctx.inputId}-${option.value}`;
                return (
                    <FieldLabel key={option.value} htmlFor={itemId}>
                        <FieldPrimitive orientation="horizontal">
                            <CheckboxPrimitive
                                id={itemId}
                                checked={field.state.value.includes(
                                    option.value,
                                )}
                                onCheckedChange={(checked) =>
                                    toggle(option.value, checked === true)
                                }
                            />
                            <FieldContent>
                                <FieldTitle>{option.label}</FieldTitle>
                            </FieldContent>
                        </FieldPrimitive>
                    </FieldLabel>
                );
            })}
        </div>
    );
}
