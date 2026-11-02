import { useFieldContext } from "#/hooks/form";
import {
    ToggleGroup as ToggleGroupRoot,
    ToggleGroupItem,
} from "@tihlde/ui/ui/toggle-group";
import { useField } from "./field";

interface ToggleGroupProps {
    options: { value: string; label: string }[];
    /** Holds a `string[]` when true, otherwise a single `string`. */
    multiple?: boolean;
}

export function ToggleGroup({ options, multiple = false }: ToggleGroupProps) {
    const field = useFieldContext<string | string[]>();
    const ctx = useField();
    const value = field.state.value;
    const selected = Array.isArray(value) ? value : value ? [value] : [];

    return (
        <ToggleGroupRoot
            variant="choice"
            size="lg"
            spacing={2}
            multiple={multiple}
            value={selected}
            onValueChange={(next) =>
                field.handleChange(multiple ? next : (next[0] ?? ""))
            }
            aria-labelledby={`${ctx.inputId}-label`}
            aria-invalid={ctx.isInvalid}
            className="flex-wrap"
        >
            {options.map((option) => (
                <ToggleGroupItem key={option.value} value={option.value}>
                    {option.label}
                </ToggleGroupItem>
            ))}
        </ToggleGroupRoot>
    );
}
