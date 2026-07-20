import { useFieldContext } from "#/hooks/form";
import {
    ImageDropzone as ImageDropzonePrimitive,
    type ImageDropzoneProps as ImageDropzonePrimitiveProps,
} from "@tihlde/ui/ui/image-dropzone";
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

const defaultLabels = {
    typeRejected: "Filtypen støttes ikke",
    dropToUpload: "Slipp for å laste opp",
    limitReached: (max: number) => `Maks ${max} bilder lastet opp`,
    addMore: (count: number, max?: number) =>
        max
            ? `Klikk eller dra for å legge til (${count}/${max})`
            : "Klikk eller dra for å legge til flere",
    replaceSingle: "Klikk eller dra for å bytte bilde",
    defaultPlaceholder: "Klikk eller dra et bilde hit for å laste opp",
    previewLabel: (name: string) => `Forhåndsvis ${name}`,
    removeLabel: "Fjern bilde",
};

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
