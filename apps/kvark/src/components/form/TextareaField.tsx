import { useFieldContext, useFieldErrorVisible } from "#/hooks/form";
import {
    Field,
    FieldDescription,
    FieldError,
    FieldLabel,
} from "@tihlde/ui/ui/field";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupTextarea,
} from "@tihlde/ui/ui/input-group";
import { Textarea } from "@tihlde/ui/ui/textarea";
import { useId } from "react";

interface BasicFieldPropBase {
    label?: string;
    required?: boolean;
    description?: string;
    hideError?: boolean;
    startAddon?: React.ReactNode;
    endAddon?: React.ReactNode;
    blockStartAddon?: React.ReactNode;
    blockEndAddon?: React.ReactNode;
}

interface TextareaFieldProps
    extends BasicFieldPropBase, React.ComponentProps<typeof Textarea> {}

export function TextareaField({
    label,
    required,
    description,
    hideError = false,
    startAddon,
    endAddon,
    blockStartAddon,
    blockEndAddon,
    ...props
}: TextareaFieldProps) {
    const field = useFieldContext<string>();
    const inputId = useId();
    const isInvalid = useFieldErrorVisible();

    const hasAddons =
        startAddon != null ||
        endAddon != null ||
        blockStartAddon != null ||
        blockEndAddon != null;

    return (
        <Field data-invalid={isInvalid}>
            {label && (
                <FieldLabel htmlFor={inputId}>
                    {label}{" "}
                    {required && <span className="text-destructive">*</span>}
                </FieldLabel>
            )}
            {hasAddons ? (
                <InputGroup>
                    {blockStartAddon != null && (
                        <InputGroupAddon align="block-start">
                            {blockStartAddon}
                        </InputGroupAddon>
                    )}
                    {startAddon != null && (
                        <InputGroupAddon align="inline-start">
                            {startAddon}
                        </InputGroupAddon>
                    )}
                    <InputGroupTextarea
                        {...props}
                        id={inputId}
                        name={field.name}
                        required={required}
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        aria-invalid={isInvalid}
                    />
                    {endAddon != null && (
                        <InputGroupAddon align="inline-end">
                            {endAddon}
                        </InputGroupAddon>
                    )}
                    {blockEndAddon != null && (
                        <InputGroupAddon align="block-end">
                            {blockEndAddon}
                        </InputGroupAddon>
                    )}
                </InputGroup>
            ) : (
                <Textarea
                    {...props}
                    id={inputId}
                    name={field.name}
                    required={required}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    aria-invalid={isInvalid}
                />
            )}
            {description && <FieldDescription>{description}</FieldDescription>}
            {!hideError && isInvalid && (
                <FieldError errors={field.state.meta.errors} />
            )}
        </Field>
    );
}
