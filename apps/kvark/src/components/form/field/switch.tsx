import { useFieldContext } from "#/hooks/form";
import { Switch as SwitchPrimitive } from "@tihlde/ui/ui/switch";
import { useField } from "./field";

type SwitchProps = Omit<
    React.ComponentProps<typeof SwitchPrimitive>,
    "checked" | "onCheckedChange" | "onBlur" | "id" | "name" | "required"
>;

export function Switch(props: SwitchProps) {
    const field = useFieldContext<boolean>();
    const ctx = useField();

    return (
        <SwitchPrimitive
            {...props}
            id={ctx.inputId}
            name={field.name}
            required={ctx.required}
            checked={field.state.value}
            onCheckedChange={(checked) => field.handleChange(checked)}
            onBlur={field.handleBlur}
            aria-invalid={ctx.isInvalid}
        />
    );
}
