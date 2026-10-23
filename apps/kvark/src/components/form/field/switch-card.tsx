import { useFieldContext } from "#/hooks/form";
import {
    FieldContent,
    Field as FieldPrimitive,
    FieldLabel,
    FieldTitle,
} from "@tihlde/ui/ui/field";
import { Switch as SwitchPrimitive } from "@tihlde/ui/ui/switch";
import { useId } from "react";

interface SwitchCardProps {
    title: string;
}

/** A yes/no question in a bordered card. Use directly inside `form.AppField`, not `field.Field`. */
export function SwitchCard({ title }: SwitchCardProps) {
    const field = useFieldContext<boolean>();
    const id = useId();

    return (
        <FieldLabel htmlFor={id}>
            <FieldPrimitive orientation="horizontal">
                <FieldContent>
                    <FieldTitle>{title}</FieldTitle>
                </FieldContent>
                <SwitchPrimitive
                    id={id}
                    name={field.name}
                    checked={field.state.value}
                    onCheckedChange={(checked) => field.handleChange(checked)}
                    onBlur={field.handleBlur}
                />
            </FieldPrimitive>
        </FieldLabel>
    );
}
