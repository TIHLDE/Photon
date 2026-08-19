import { Field, FieldDescription, FieldLabel } from "@tihlde/ui/ui/field";
import { ImageDropzone } from "@tihlde/ui/ui/image-dropzone";
import {
    ImagePresetFrame,
    type ImagePresetName,
} from "@tihlde/ui/ui/image-preset";

import { imageDropzoneLabels } from "#/lib/image";

type AdminImageFieldProps = {
    label: string;
    description?: string;
    /**
     * Which public surface the image ends up on. Drives the crop the editor
     * previews, so the dropzone shows the published result rather than a
     * generic thumbnail.
     */
    preset: ImagePresetName;
    value: File | null;
    onChange: (file: File | null) => void;
    /** Image already saved on the resource, shown until a new one is picked. */
    existingImageUrl?: string | null;
    disabled?: boolean;
    /**
     * Vis bildet uten opplastingsflate. `disabled` alene holder ikke: sonen
     * blir inert, men fortsetter å be om en fil den ikke tar imot.
     */
    readOnly?: boolean;
    /** Layout-only classes for the field wrapper, e.g. a grid column span. */
    className?: string;
};

/**
 * Single-image upload field for the admin panel.
 *
 * Wraps the shared dropzone so every admin surface gets the same behaviour:
 * in-browser compression before upload, and a preview in the exact crop the
 * image will have once published.
 */
export function AdminImageField({
    label,
    description,
    preset,
    value,
    onChange,
    existingImageUrl,
    disabled,
    readOnly,
    className,
}: AdminImageFieldProps) {
    return (
        <Field className={className}>
            <FieldLabel>{label}</FieldLabel>
            {description ? (
                <FieldDescription>{description}</FieldDescription>
            ) : null}
            {readOnly ? (
                <ImagePresetFrame
                    preset={preset}
                    src={existingImageUrl ?? undefined}
                    alt=""
                    fallback={<span>Ingen bilde</span>}
                />
            ) : (
                <ImageDropzone
                    preset={preset}
                    value={value ? [value] : []}
                    onValueChange={(next) => onChange(next[0] ?? null)}
                    existingImageUrl={existingImageUrl}
                    accept={{ "image/*": [] }}
                    disabled={disabled}
                    labels={imageDropzoneLabels}
                />
            )}
        </Field>
    );
}
