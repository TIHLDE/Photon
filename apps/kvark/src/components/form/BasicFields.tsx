import { useFieldContext } from "#/hooks/form";
import {
    Field,
    FieldDescription,
    FieldError,
    FieldLabel,
} from "@tihlde/ui/ui/field";
import { Input } from "@tihlde/ui/ui/input";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupInput,
} from "@tihlde/ui/ui/input-group";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useId, useState } from "react";

interface BasicFieldPropBase {
    label?: string;
    required?: boolean;
    description?: string;
    hideError?: boolean;
}

interface InputFieldProps
    extends BasicFieldPropBase, React.ComponentProps<typeof Input> {}

export function InputField({
    label,
    required,
    description,
    hideError = false,
    type,
    ...props
}: InputFieldProps) {
    const field = useFieldContext<string>();
    const inputId = useId();

    const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

    return (
        <Field
            data-invalid={
                field.state.meta.isTouched && !field.state.meta.isValid
            }
        >
            {label && (
                <FieldLabel htmlFor={inputId}>
                    {label}{" "}
                    {required && <span className="text-destructive">*</span>}
                </FieldLabel>
            )}
            <Input
                {...props}
                id={inputId}
                name={field.name}
                required={required}
                type={type}
                value={field.state.value}
                onChange={(e) => {
                    switch (type) {
                        case "number":
                            field.handleChange(
                                e.target.valueAsNumber as unknown as string,
                            );
                            break;

                        case "date":
                        case "datetime-local":
                            field.handleChange(
                                e.target.valueAsDate as unknown as string,
                            );
                            break;

                        default:
                            field.handleChange(e.target.value);
                    }
                }}
                onBlur={field.handleBlur}
                aria-invalid={isInvalid}
            />
            {description && <FieldDescription>{description}</FieldDescription>}
            {!hideError && isInvalid && (
                <FieldError errors={field.state.meta.errors} />
            )}
        </Field>
    );
}

interface PasswordFieldProps
    extends BasicFieldPropBase, React.ComponentProps<typeof InputGroupInput> {}

export function PasswordField({
    label,
    required,
    description,
    hideError = false,
    autoComplete = "current-password",
    ...props
}: Omit<PasswordFieldProps, "type">) {
    const field = useFieldContext<string>();
    const inputId = useId();
    const [showPassword, setShowPassword] = useState(false);

    const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

    return (
        <Field
            data-invalid={
                field.state.meta.isTouched && !field.state.meta.isValid
            }
        >
            {label && (
                <FieldLabel htmlFor={inputId}>
                    {label}{" "}
                    {required && <span className="text-destructive">*</span>}
                </FieldLabel>
            )}
            <InputGroup>
                <InputGroupInput
                    {...props}
                    type={showPassword ? "text" : "password"}
                    id={inputId}
                    name={field.name}
                    required={required}
                    value={field.state.value}
                    autoComplete={autoComplete}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    aria-invalid={isInvalid}
                />
                <InputGroupAddon align="inline-end">
                    <InputGroupButton
                        size="icon-xs"
                        onClick={() => setShowPassword((prev) => !prev)}
                    >
                        {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                    </InputGroupButton>
                </InputGroupAddon>
            </InputGroup>
            {description && <FieldDescription>{description}</FieldDescription>}
            {!hideError && isInvalid && (
                <FieldError errors={field.state.meta.errors} />
            )}
        </Field>
    );
}
