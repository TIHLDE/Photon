"use client";

import * as React from "react";
import { ImagePlusIcon, XIcon } from "lucide-react";
import { type Accept, useDropzone } from "react-dropzone";

import { cn } from "#/lib/utils";
import { Button } from "#/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "#/components/ui/dialog";

export interface ImageDropzoneProps {
    value: File[];
    onValueChange: (next: File[]) => void;
    onError?: (errors: string[]) => void;
    onBlur?: () => void;
    accept?: Accept;
    minSize?: number;
    maxSize?: number;
    maxFiles?: number;
    multiple?: boolean;
    placeholder?: string;
    disabled?: boolean;
    id?: string;
    name?: string;
    required?: boolean;
    "aria-invalid"?: boolean;
    className?: string;
    labels?: Partial<DropzoneLabels>;
}

export interface DropzoneLabels {
    typeRejected: string;
    dropToUpload: string;
    limitReached: (max: number) => string;
    addMore: (count: number, max?: number) => string;
    replaceSingle: string;
    defaultPlaceholder: string;
    previewLabel: (name: string) => string;
    removeLabel: string;
}

const defaultLabels: DropzoneLabels = {
    typeRejected: "File type not supported",
    dropToUpload: "Drop to upload",
    limitReached: (max) => `Reached limit of ${max} files`,
    addMore: (count, max) =>
        max ? `Click or drag to add (${count}/${max})` : "Click or drag to add",
    replaceSingle: "Click or drag to replace",
    defaultPlaceholder: "Click or drag an image here to upload",
    previewLabel: (name) => `Preview ${name}`,
    removeLabel: "Remove image",
};

type Preview = { file: File; url: string };

function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatType(file: File): string {
    return file.type.split("/")[1]?.toUpperCase() ?? "";
}

function getDropzoneText(
    state: {
        isDragReject: boolean;
        isDragActive: boolean;
        reachedLimit: boolean;
        multiple: boolean;
        fileCount: number;
        maxFiles?: number;
        placeholder: string;
    },
    labels: DropzoneLabels,
): string {
    if (state.isDragReject) return labels.typeRejected;
    if (state.isDragActive) return labels.dropToUpload;
    if (state.reachedLimit && state.maxFiles)
        return labels.limitReached(state.maxFiles);
    if (state.multiple && state.fileCount > 0) {
        return labels.addMore(state.fileCount, state.maxFiles);
    }
    if (!state.multiple && state.fileCount > 0) {
        return labels.replaceSingle;
    }
    return state.placeholder;
}

export function ImageDropzone({
    value,
    onValueChange,
    onError,
    onBlur,
    accept = { "image/*": [] },
    minSize,
    maxSize,
    maxFiles,
    multiple = false,
    placeholder,
    disabled,
    id,
    name,
    required,
    "aria-invalid": ariaInvalid,
    className,
    labels: userLabels,
}: ImageDropzoneProps) {
    const labels = React.useMemo(
        () => ({ ...defaultLabels, ...userLabels }),
        [userLabels],
    );
    const resolvedPlaceholder = placeholder ?? labels.defaultPlaceholder;

    const [previews, setPreviews] = React.useState<Preview[]>([]);
    const [previewIndex, setPreviewIndex] = React.useState<number | null>(null);

    React.useEffect(() => {
        const next = value.map((file) => ({
            file,
            url: URL.createObjectURL(file),
        }));
        setPreviews(next);
        return () => {
            next.forEach((p) => URL.revokeObjectURL(p.url));
        };
    }, [value]);

    const reachedLimit =
        multiple && maxFiles !== undefined && value.length >= maxFiles;

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
                onError?.(
                    rejected.flatMap((r) => r.errors.map((e) => e.message)),
                );
                if (!multiple) {
                    onValueChange(accepted.slice(0, 1));
                } else {
                    const merged = [...value, ...accepted];
                    onValueChange(
                        maxFiles ? merged.slice(0, maxFiles) : merged,
                    );
                }
                onBlur?.();
            },
        });

    const removeAt = (index: number) => {
        const next = value.filter((_, i) => i !== index);
        onValueChange(next);
        onError?.([]);
        if (previewIndex !== null && index <= previewIndex) {
            setPreviewIndex(
                previewIndex === index || next.length === 0
                    ? null
                    : previewIndex - 1,
            );
        }
    };

    const dropzoneText = getDropzoneText(
        {
            isDragReject,
            isDragActive,
            reachedLimit,
            multiple,
            fileCount: previews.length,
            maxFiles,
            placeholder: resolvedPlaceholder,
        },
        labels,
    );

    return (
        <>
            <div
                {...getRootProps({
                    className: cn("flex flex-col gap-3", className),
                })}
            >
                <input
                    {...getInputProps({
                        id,
                        name,
                        required: required && previews.length === 0,
                        "aria-invalid": ariaInvalid,
                    })}
                />
                <Button
                    type="button"
                    variant="outline"
                    onClick={open}
                    disabled={disabled || reachedLimit}
                    aria-invalid={ariaInvalid}
                    className="flex h-auto w-full flex-col items-center justify-center gap-2 px-4 py-6 aria-invalid:text-destructive"
                >
                    <ImagePlusIcon className="size-5" />
                    <span>{dropzoneText}</span>
                </Button>
                {previews.length > 0 && (
                    <ul className="flex flex-col gap-1">
                        {previews.map((preview, i) => (
                            <DropzonePreviewItem
                                key={`${preview.file.name}-${preview.file.size}-${i}`}
                                preview={preview}
                                disabled={disabled}
                                previewLabel={labels.previewLabel}
                                removeLabel={labels.removeLabel}
                                onPreview={() => setPreviewIndex(i)}
                                onRemove={() => removeAt(i)}
                            />
                        ))}
                    </ul>
                )}
            </div>
            <DropzonePreviewDialog
                preview={
                    previewIndex !== null
                        ? (previews[previewIndex] ?? null)
                        : null
                }
                onClose={() => setPreviewIndex(null)}
            />
        </>
    );
}

interface DropzonePreviewItemProps {
    preview: Preview;
    disabled?: boolean;
    previewLabel: (name: string) => string;
    removeLabel: string;
    onPreview: () => void;
    onRemove: () => void;
}

function DropzonePreviewItem({
    preview,
    disabled,
    previewLabel,
    removeLabel,
    onPreview,
    onRemove,
}: DropzonePreviewItemProps) {
    const { file, url } = preview;
    const type = formatType(file);

    return (
        <li
            role="button"
            tabIndex={0}
            aria-label={previewLabel(file.name)}
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
                aria-label={removeLabel}
            >
                <XIcon />
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
