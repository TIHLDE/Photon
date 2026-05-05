import { useFieldContext, useFieldErrorVisible } from "#/hooks/form";
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
    startAddon?: React.ReactNode;
    endAddon?: React.ReactNode;
}

interface InputFieldProps
    extends BasicFieldPropBase, React.ComponentProps<typeof Input> {}

export function InputField({
    label,
    required,
    description,
    hideError = false,
    startAddon,
    endAddon,
    type,
    ...props
}: InputFieldProps) {
    const field = useFieldContext<string>();
    const inputId = useId();
    const isInvalid = useFieldErrorVisible();

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

    const hasAddons = startAddon != null || endAddon != null;

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
                    {startAddon != null && (
                        <InputGroupAddon align="inline-start">
                            {startAddon}
                        </InputGroupAddon>
                    )}
                    <InputGroupInput
                        {...props}
                        id={inputId}
                        name={field.name}
                        required={required}
                        type={type}
                        value={field.state.value}
                        onChange={onChange}
                        onBlur={field.handleBlur}
                        aria-invalid={isInvalid}
                    />
                    {endAddon != null && (
                        <InputGroupAddon align="inline-end">
                            {endAddon}
                        </InputGroupAddon>
                    )}
                </InputGroup>
            ) : (
                <Input
                    {...props}
                    id={inputId}
                    name={field.name}
                    required={required}
                    type={type}
                    value={field.state.value}
                    onChange={onChange}
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

interface PasswordFieldProps
    extends BasicFieldPropBase, React.ComponentProps<typeof InputGroupInput> {}

export function PasswordField({
    label,
    required,
    description,
    hideError = false,
    autoComplete = "current-password",
    startAddon,
    endAddon,
    ...props
}: Omit<PasswordFieldProps, "type">) {
    const field = useFieldContext<string>();
    const inputId = useId();
    const [showPassword, setShowPassword] = useState(false);
    const isInvalid = useFieldErrorVisible();

    return (
        <Field data-invalid={isInvalid}>
            {label && (
                <FieldLabel htmlFor={inputId}>
                    {label}{" "}
                    {required && <span className="text-destructive">*</span>}
                </FieldLabel>
            )}
            <InputGroup>
                {startAddon != null && (
                    <InputGroupAddon align="inline-start">
                        {startAddon}
                    </InputGroupAddon>
                )}
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
                    {endAddon}
                    <InputGroupButton
                        size="icon-xs"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={
                            showPassword ? "Skjul passord" : "Vis passord"
                        }
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
