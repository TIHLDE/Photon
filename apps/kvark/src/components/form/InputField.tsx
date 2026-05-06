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
    InputGroupButton,
    InputGroupInput,
} from "@tihlde/ui/ui/input-group";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useId, useState } from "react";

interface InputFieldProps extends React.ComponentProps<typeof InputGroupInput> {
    label?: string;
    required?: boolean;
    description?: string;
    hideError?: boolean;
    children?: React.ReactNode;
}

export function InputField({
    label,
    required,
    description,
    hideError = false,
    children,
    type,
    autoComplete,
    ...props
}: InputFieldProps) {
    const field = useFieldContext<string>();
    const inputId = useId();
    const isInvalid = useFieldErrorVisible();
    const [showPassword, setShowPassword] = useState(false);

    const isPassword = type === "password";
    const resolvedType = isPassword && showPassword ? "text" : type;
    const resolvedAutoComplete =
        autoComplete ?? (isPassword ? "current-password" : undefined);

    const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        switch (type) {
            case "number":
                field.handleChange(e.target.valueAsNumber as unknown as string);
                break;
            case "date":
            case "datetime-local":
                field.handleChange(e.target.valueAsDate as unknown as string);
                break;
            default:
                field.handleChange(e.target.value);
        }
    };

    return (
        <Field data-invalid={isInvalid}>
            {label && (
                <FieldLabel htmlFor={inputId}>
                    {label}{" "}
                    {required && <span className="text-destructive">*</span>}
                </FieldLabel>
            )}
            <InputGroup>
                <InputGroupInput
                    {...props}
                    id={inputId}
                    name={field.name}
                    required={required}
                    type={resolvedType}
                    autoComplete={resolvedAutoComplete}
                    value={field.state.value}
                    onChange={onChange}
                    onBlur={field.handleBlur}
                    aria-invalid={isInvalid}
                />
                {children}
                {isPassword && (
                    <InputGroupAddon align="inline-end">
                        <InputGroupButton
                            size="icon-xs"
                            tabIndex={-1}
                            onClick={() => setShowPassword((prev) => !prev)}
                            aria-label={
                                showPassword ? "Skjul passord" : "Vis passord"
                            }
                        >
                            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                        </InputGroupButton>
                    </InputGroupAddon>
                )}
            </InputGroup>
            {description && !isInvalid && (
                <FieldDescription>{description}</FieldDescription>
            )}
            {!hideError && isInvalid && (
                <FieldError errors={field.state.meta.errors} />
            )}
        </Field>
    );
}
