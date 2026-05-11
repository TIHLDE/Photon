import { useFieldContext } from "#/hooks/form";
import { Input as InputPrimitive } from "@tihlde/ui/ui/input";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupInput,
    InputGroupTextarea,
} from "@tihlde/ui/ui/input-group";
import { Textarea as TextareaPrimitive } from "@tihlde/ui/ui/textarea";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { Children, useState } from "react";
import { useField } from "./field";

type TextInputType = "text" | "email" | "url" | "search" | "tel" | "password";

interface InputProps extends Omit<
    React.ComponentProps<"input">,
    "value" | "required" | "type"
> {
    type?: TextInputType;
    children?: React.ReactNode;
}

export function Input({ children, type = "text", ...props }: InputProps) {
    const field = useFieldContext<string>();
    const ctx = useField();
    const hasAddons = Children.count(children) > 0;

    const inputProps = {
        ...props,
        id: ctx.inputId,
        name: field.name,
        required: ctx.required,
        type,
        value: field.state.value,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            field.handleChange(e.target.value),
        onBlur: field.handleBlur,
        "aria-invalid": ctx.isInvalid,
    };

    if (hasAddons) {
        return (
            <InputGroup>
                <InputGroupInput {...inputProps} />
                {children}
            </InputGroup>
        );
    }
    return <InputPrimitive {...inputProps} />;
}

type PasswordProps = Omit<InputProps, "type" | "children">;

export function Password({
    autoComplete = "current-password",
    ...props
}: PasswordProps) {
    const [show, setShow] = useState(false);

    return (
        <Input
            {...props}
            type={show ? "text" : "password"}
            autoComplete={autoComplete}
        >
            <InputGroupAddon align="inline-end">
                <InputGroupButton
                    size="icon-xs"
                    tabIndex={-1}
                    onClick={() => setShow((s) => !s)}
                    aria-label={show ? "Skjul passord" : "Vis passord"}
                >
                    {show ? <EyeOffIcon /> : <EyeIcon />}
                </InputGroupButton>
            </InputGroupAddon>
        </Input>
    );
}

interface TextareaProps extends Omit<
    React.ComponentProps<"textarea">,
    "value" | "required"
> {
    children?: React.ReactNode;
}

export function Textarea({ children, ...props }: TextareaProps) {
    const field = useFieldContext<string>();
    const ctx = useField();
    const hasAddons = Children.count(children) > 0;

    const inputProps = {
        ...props,
        id: ctx.inputId,
        name: field.name,
        required: ctx.required,
        value: field.state.value,
        onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) =>
            field.handleChange(e.target.value),
        onBlur: field.handleBlur,
        "aria-invalid": ctx.isInvalid,
    };

    if (hasAddons) {
        return (
            <InputGroup>
                <InputGroupTextarea {...inputProps} />
                {children}
            </InputGroup>
        );
    }
    return <TextareaPrimitive {...inputProps} />;
}
