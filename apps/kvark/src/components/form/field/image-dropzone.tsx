import { useFieldContext } from "#/hooks/form";
import { Button } from "@tihlde/ui/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@tihlde/ui/ui/dialog";
import { ImagePlus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { type Accept, useDropzone } from "react-dropzone";
import { useField } from "./field";

interface ImageDropzoneProps {
    accept?: Accept;
    minSize?: number;
    maxSize?: number;
    maxFiles?: number;
    multiple?: boolean;
    placeholder?: string;
    disabled?: boolean;
}

type Preview = { file: File; url: string };

function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatType(file: File): string {
    return file.type.split("/")[1]?.toUpperCase() ?? "";
}

function getDropzoneText(state: {
    isDragReject: boolean;
    isDragActive: boolean;
    reachedLimit: boolean;
    multiple: boolean;
    fileCount: number;
    maxFiles?: number;
    placeholder: string;
}): string {
    if (state.isDragReject) return "Filtypen støttes ikke";
    if (state.isDragActive) return "Slipp for å laste opp";
    if (state.reachedLimit) return `Maks ${state.maxFiles} bilder lastet opp`;
    if (state.multiple && state.fileCount > 0) {
        return state.maxFiles
            ? `Klikk eller dra for å legge til (${state.fileCount}/${state.maxFiles})`
            : "Klikk eller dra for å legge til flere";
    }
    if (!state.multiple && state.fileCount > 0) {
        return "Klikk eller dra for å bytte bilde";
    }
    return state.placeholder;
}

export function ImageDropzone({
    accept = { "image/*": [] },
    minSize,
    maxSize,
    maxFiles,
    multiple = false,
    placeholder = "Klikk eller dra et bilde hit for å laste opp",
    disabled,
}: ImageDropzoneProps) {
    const field = useFieldContext<File | File[] | null>();
    const ctx = useField();
    const [previewIndex, setPreviewIndex] = useState<number | null>(null);

    const previews = useMemo<Preview[]>(() => {
        const value = field.state.value;
        const files = !value ? [] : Array.isArray(value) ? value : [value];
        return files.map((file) => ({ file, url: URL.createObjectURL(file) }));
    }, [field.state.value]);

    useEffect(() => {
        return () => previews.forEach((p) => URL.revokeObjectURL(p.url));
    }, [previews]);

    const setValue = (next: File[]) => {
        field.handleChange(multiple ? next : (next[0] ?? null));
    };

    const removeAt = (index: number) => {
        const next = previews.map((p) => p.file).filter((_, i) => i !== index);
        setValue(next);
        ctx.setExtraErrors([]);
        if (previewIndex === index) setPreviewIndex(null);
    };

    const reachedLimit =
        multiple && maxFiles !== undefined && previews.length >= maxFiles;

    const { getRootProps, getInputProps, isDragActive, isDragReject, open } =
        useDropzone({
            accept,
            minSize,
            maxSize,
            maxFiles: multiple ? maxFiles : 1,
            multiple,
            disabled: disabled || reachedLimit,
            noClick: true,
            noKeyboard: true,
            onDrop: (accepted, rejected) => {
                ctx.setExtraErrors(
                    rejected.flatMap((r) => r.errors.map((e) => e.message)),
                );
                if (!multiple) {
                    setValue(accepted.slice(0, 1));
                } else {
                    const merged = [
                        ...previews.map((p) => p.file),
                        ...accepted,
                    ];
                    setValue(maxFiles ? merged.slice(0, maxFiles) : merged);
                }
                field.handleBlur();
            },
        });

    const dropzoneText = getDropzoneText({
        isDragReject,
        isDragActive,
        reachedLimit,
        multiple,
        fileCount: previews.length,
        maxFiles,
        placeholder,
    });

    return (
        <>
            <div {...getRootProps({ className: "flex flex-col gap-3" })}>
                <input
                    {...getInputProps({
                        id: ctx.inputId,
                        name: field.name,
                        required: ctx.required && previews.length === 0,
                        "aria-invalid": ctx.isInvalid,
                    })}
                />
                <Button
                    type="button"
                    variant="outline"
                    onClick={open}
                    disabled={disabled || reachedLimit}
                    aria-invalid={ctx.isInvalid}
                    className="flex h-auto w-full flex-col items-center justify-center gap-2 px-4 py-6 aria-invalid:text-destructive"
                >
                    <ImagePlus className="size-5" />
                    <span>{dropzoneText}</span>
                </Button>
                {previews.length > 0 && (
                    <ul className="flex flex-col gap-1">
                        {previews.map((preview, i) => (
                            <DropzonePreviewItem
                                key={`${preview.file.name}-${preview.file.size}-${i}`}
                                preview={preview}
                                disabled={disabled}
                                onPreview={() => setPreviewIndex(i)}
                                onRemove={() => removeAt(i)}
                            />
                        ))}
                    </ul>
                )}
            </div>
            <DropzonePreviewDialog
                preview={previewIndex !== null ? previews[previewIndex] : null}
                onClose={() => setPreviewIndex(null)}
            />
        </>
    );
}

interface DropzonePreviewItemProps {
    preview: Preview;
    disabled?: boolean;
    onPreview: () => void;
    onRemove: () => void;
}

function DropzonePreviewItem({
    preview,
    disabled,
    onPreview,
    onRemove,
}: DropzonePreviewItemProps) {
    const { file, url } = preview;
    const type = formatType(file);

    return (
        <li
            role="button"
            tabIndex={0}
            aria-label={`Forhåndsvis ${file.name}`}
            onClick={onPreview}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onPreview();
                }
            }}
            className="flex cursor-pointer items-center gap-3 rounded-md p-1.5 transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
        >
            <img
                src={url}
                alt={file.name}
                className="size-10 shrink-0 rounded-sm object-cover"
            />
            <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm">{file.name}</span>
                <span className="text-xs text-muted-foreground">
                    {formatSize(file.size)}
                    {type ? ` · ${type}` : ""}
                </span>
            </div>
            <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                onClick={(e) => {
                    e.stopPropagation();
                    onRemove();
                }}
                disabled={disabled}
                aria-label="Fjern bilde"
            >
                <X />
            </Button>
        </li>
    );
}

interface DropzonePreviewDialogProps {
    preview: Preview | null;
    onClose: () => void;
}

function DropzonePreviewDialog({
    preview,
    onClose,
}: DropzonePreviewDialogProps) {
    return (
        <Dialog
            open={preview !== null}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
        >
            {preview && (
                <DialogContent className="sm:max-w-3xl">
                    <DialogTitle className="truncate pr-8 text-sm font-medium">
                        {preview.file.name}
                    </DialogTitle>
                    <img
                        src={preview.url}
                        alt={preview.file.name}
                        className="max-h-[80vh] w-full rounded-lg object-contain"
                    />
                </DialogContent>
            )}
        </Dialog>
    );
}
