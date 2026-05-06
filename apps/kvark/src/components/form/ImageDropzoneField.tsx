import { useFieldContext, useFieldErrorVisible } from "#/hooks/form";
import { Button } from "@tihlde/ui/ui/button";
import {
    Field,
    FieldDescription,
    FieldError,
    FieldLabel,
} from "@tihlde/ui/ui/field";
import { ImagePlus, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef } from "react";

interface BasicFieldPropBase {
    label?: string;
    required?: boolean;
    description?: string;
    hideError?: boolean;
}

interface ImageDropzoneFieldProps extends BasicFieldPropBase {
    accept?: string;
    placeholder?: string;
    disabled?: boolean;
}

export function ImageDropzoneField({
    label,
    required,
    description,
    hideError = false,
    accept = "image/*",
    placeholder = "Klikk eller dra et bilde hit for å laste opp",
    disabled,
}: ImageDropzoneFieldProps) {
    const field = useFieldContext<File | null>();
    const inputRef = useRef<HTMLInputElement>(null);
    const inputId = useId();
    const isInvalid = useFieldErrorVisible();
    const value = field.state.value;

    const previewUrl = useMemo(
        () => (value ? URL.createObjectURL(value) : null),
        [value],
    );

    useEffect(() => {
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        };
    }, [previewUrl]);

    const clear = () => {
        field.handleChange(null);
        if (inputRef.current) inputRef.current.value = "";
    };

    return (
        <Field data-invalid={isInvalid}>
            {label && (
                <FieldLabel htmlFor={inputId}>
                    {label}{" "}
                    {required && <span className="text-destructive">*</span>}
                </FieldLabel>
            )}
            <input
                ref={inputRef}
                id={inputId}
                name={field.name}
                type="file"
                accept={accept}
                required={required}
                disabled={disabled}
                className="sr-only"
                onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    field.handleChange(file);
                }}
                aria-invalid={isInvalid}
            />
            {previewUrl ? (
                <div className="relative">
                    <img
                        src={previewUrl}
                        alt=""
                        className="aspect-video w-full rounded-md object-cover"
                    />
                    <Button
                        type="button"
                        size="icon-sm"
                        variant="outline"
                        className="absolute top-2 right-2"
                        onClick={clear}
                        disabled={disabled}
                        aria-label="Fjern bilde"
                    >
                        <X />
                    </Button>
                </div>
            ) : (
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => inputRef.current?.click()}
                    disabled={disabled}
                    className="flex h-auto w-full flex-col items-center justify-center gap-2 px-4 py-8"
                >
                    <ImagePlus className="size-5" />
                    <span>{placeholder}</span>
                </Button>
            )}
            {description && !isInvalid && (
                <FieldDescription>{description}</FieldDescription>
            )}
            {!hideError && isInvalid && (
                <FieldError errors={field.state.meta.errors} />
            )}
        </Field>
    );
}
