import { useFieldErrorVisible } from "#/hooks/form";
import { Field as FieldPrimitive } from "@tihlde/ui/ui/field";
import { createContext, useContext, useId, useMemo, useState } from "react";

export type FieldContextValue = {
    inputId: string;
    required: boolean;
    isInvalid: boolean;
    extraErrors: string[];
    setExtraErrors: (errors: string[]) => void;
};

const FieldContext = createContext<FieldContextValue | null>(null);

export function useField(): FieldContextValue {
    const ctx = useContext(FieldContext);
    if (!ctx) {
        throw new Error("Field parts must be used inside <field.Field>");
    }
    return ctx;
}

interface FieldProps extends React.ComponentProps<typeof FieldPrimitive> {
    required?: boolean;
}

export function Field({ required = false, children, ...props }: FieldProps) {
    const inputId = useId();
    const isInvalidFromForm = useFieldErrorVisible();
    const [extraErrors, setExtraErrors] = useState<string[]>([]);
    const isInvalid = isInvalidFromForm || extraErrors.length > 0;

    const value = useMemo<FieldContextValue>(
        () => ({
            inputId,
            required,
            isInvalid,
            extraErrors,
            setExtraErrors,
        }),
        [inputId, required, isInvalid, extraErrors],
    );

    return (
        <FieldContext.Provider value={value}>
            <FieldPrimitive data-invalid={isInvalid} {...props}>
                {children}
            </FieldPrimitive>
        </FieldContext.Provider>
    );
}
