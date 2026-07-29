import { useFieldContext } from "#/hooks/form";
import {
    ImageDropzone as ImageDropzonePrimitive,
    type ImageDropzoneProps as ImageDropzonePrimitiveProps,
} from "@tihlde/ui/ui/image-dropzone";
import { imageDropzoneLabels } from "#/lib/image";
import { useField } from "./field";

type ImageDropzoneProps = Omit<
    ImageDropzonePrimitiveProps,
    | "value"
    | "onValueChange"
    | "onError"
    | "onBlur"
    | "id"
    | "name"
    | "required"
    | "aria-invalid"
> & {
    labels?: ImageDropzonePrimitiveProps["labels"];
};

const defaultLabels = imageDropzoneLabels;

export function ImageDropzone({
    multiple = false,
    labels,
    ...rest
}: ImageDropzoneProps) {
    const field = useFieldContext<File | File[] | null>();
    const ctx = useField();

    const value = toFileArray(field.state.value);

    return (
        <ImageDropzonePrimitive
            {...rest}
            multiple={multiple}
            value={value}
            onValueChange={(next) =>
                field.handleChange(multiple ? next : (next[0] ?? null))
            }
            onError={(errors) => ctx.setExtraErrors(errors)}
            onBlur={field.handleBlur}
            id={ctx.inputId}
            name={field.name}
            required={ctx.required}
            aria-invalid={ctx.isInvalid}
            labels={{ ...defaultLabels, ...labels }}
        />
    );
}

function toFileArray(value: File | File[] | null): File[] {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
}
