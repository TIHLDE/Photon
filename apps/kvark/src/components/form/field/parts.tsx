import { useFieldContext } from "#/hooks/form";
import { FieldDescription, FieldError, FieldLabel } from "@tihlde/ui/ui/field";
import { useField } from "./field";

interface LabelProps extends React.ComponentProps<typeof FieldLabel> {
    required?: boolean;
    children?: React.ReactNode;
}

export function Label({
    required: requiredProp,
    children,
    ...props
}: LabelProps) {
    const ctx = useField();
    const required = requiredProp ?? ctx.required;

    return (
        <FieldLabel
            id={`${ctx.inputId}-label`}
            htmlFor={ctx.inputId}
            required={required}
            {...props}
        >
            {children}
        </FieldLabel>
    );
}

export function Description({
    children,
    ...props
}: React.ComponentProps<typeof FieldDescription>) {
    const { isInvalid } = useField();
    if (isInvalid) return null;
    return <FieldDescription {...props}>{children}</FieldDescription>;
}

export function Error() {
    const field = useFieldContext();
    const { isInvalid, extraErrors } = useField();

    if (!isInvalid) return null;

    const formErrors = (field.state.meta.errors ?? []) as Array<
        { message?: string } | undefined
    >;
    const errors = [
        ...formErrors,
        ...extraErrors.map((message) => ({ message })),
    ];

    return <FieldError errors={errors} />;
}
