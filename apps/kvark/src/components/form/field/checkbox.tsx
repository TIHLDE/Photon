import { useFieldContext } from "#/hooks/form";
import { Checkbox as CheckboxPrimitive } from "@tihlde/ui/ui/checkbox";
import { useField } from "./field";

type CheckboxProps = Omit<
    React.ComponentProps<typeof CheckboxPrimitive>,
    "checked" | "onCheckedChange" | "onBlur" | "id" | "name" | "required"
>;

export function Checkbox(props: CheckboxProps) {
    const field = useFieldContext<boolean>();
    const ctx = useField();

    return (
        <CheckboxPrimitive
            {...props}
            id={ctx.inputId}
            name={field.name}
            required={ctx.required}
            checked={field.state.value}
            onCheckedChange={(checked) => field.handleChange(checked === true)}
            onBlur={field.handleBlur}
            aria-invalid={ctx.isInvalid}
        />
    );
}
