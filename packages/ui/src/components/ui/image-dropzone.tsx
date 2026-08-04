"use client";

import * as React from "react";
import { ImagePlusIcon, UploadIcon, XIcon } from "lucide-react";
import { type Accept, useDropzone } from "react-dropzone";

import { cn } from "#/lib/utils";
import { compressImageFiles } from "#/lib/image-compression";
import { Button } from "#/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "#/components/ui/dialog";
import {
    IMAGE_PRESETS,
    type ImagePresetName,
    ImagePresetFrame,
} from "#/components/ui/image-preset";

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
    /**
     * Which surface the image ends up on. When set, the preview is rendered in
     * that surface's exact crop instead of a generic thumbnail, so the editor
     * sees the published result before saving.
     */
    preset?: ImagePresetName;
    /**
     * Already-uploaded image to show when nothing new has been picked. Lets an
     * edit form open on the current image rather than an empty dropzone.
     */
    existingImageUrl?: string | null;
    /**
     * Skip the in-browser downscale. Only for files that must reach the server
     * byte for byte; the server still optimizes images either way.
     */
    disableCompression?: boolean;
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
    compressing: string;
    replaceImage: string;
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
    compressing: "Preparing image…",
    replaceImage: "Click to replace image",
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
    preset,
    existingImageUrl,
    disableCompression = false,
}: ImageDropzoneProps) {
    const labels = React.useMemo(
        () => ({ ...defaultLabels, ...userLabels }),
        [userLabels],
    );
    const resolvedPlaceholder = placeholder ?? labels.defaultPlaceholder;

    const [previews, setPreviews] = React.useState<Preview[]>([]);
    const [previewIndex, setPreviewIndex] = React.useState<number | null>(null);
    const [isCompressing, setIsCompressing] = React.useState(false);

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
            disabled: disabled || reachedLimit || isCompressing,
            noClick: true,
            noKeyboard: true,
            onDrop: async (accepted, rejected) => {
                onError?.(
                    rejected.flatMap((r) => r.errors.map((e) => e.message)),
                );

                let files: File[] = accepted;
                if (!disableCompression && accepted.length > 0) {
                    setIsCompressing(true);
                    try {
                        files = await compressImageFiles(accepted);
                    } finally {
                        setIsCompressing(false);
                    }
                }

                if (!multiple) {
                    onValueChange(files.slice(0, 1));
                } else {
                    const merged = [...value, ...files];
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

    const dropzoneText = isCompressing
        ? labels.compressing
        : getDropzoneText(
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

    // With a preset and a single slot, the preview *is* the control: the editor
    // clicks the framed image itself to swap it, exactly as it will look once
    // published.
    const singlePresetPreview =
        preset && !multiple
            ? (previews[0]?.url ?? existingImageUrl ?? null)
            : null;
    const showSingleFrame = preset !== undefined && !multiple;

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

                {showSingleFrame ? (
                    <ImagePresetFrame
                        preset={preset}
                        src={singlePresetPreview ?? undefined}
                        alt=""
                        containerClassName={cn(
                            "border-2 border-dashed",
                            isDragActive && !isDragReject && "border-primary",
                            isDragReject && "border-destructive",
                            ariaInvalid && "border-destructive",
                        )}
                        fallback={
                            <span className="flex flex-col items-center gap-2 px-4 text-center">
                                <ImagePlusIcon className="size-6" />
                                <span>{dropzoneText}</span>
                            </span>
                        }
                        overlay={
                            <button
                                type="button"
                                onClick={open}
                                disabled={disabled || isCompressing}
                                aria-label={labels.replaceImage}
                                className={cn(
                                    "absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm font-medium text-white transition-opacity focus-visible:outline-none disabled:cursor-not-allowed",
                                    singlePresetPreview
                                        ? "bg-black/55 opacity-0 hover:opacity-100 focus-visible:opacity-100"
                                        : "opacity-0",
                                )}
                            >
                                <UploadIcon className="size-6" aria-hidden />
                                <span>
                                    {isCompressing
                                        ? labels.compressing
                                        : labels.replaceImage}
                                </span>
                            </button>
                        }
                    />
                ) : (
                    <Button
                        type="button"
                        variant="outline"
                        onClick={open}
                        disabled={disabled || reachedLimit || isCompressing}
                        aria-invalid={ariaInvalid}
                        className="flex h-auto w-full flex-col items-center justify-center gap-2 px-4 py-6 aria-invalid:text-destructive"
                    >
                        <ImagePlusIcon className="size-5" />
                        <span>{dropzoneText}</span>
                    </Button>
                )}

                {preset ? (
                    <p className="text-xs text-muted-foreground">
                        {IMAGE_PRESETS[preset].hint}
                        {IMAGE_PRESETS[preset].recommended
                            ? ` Anbefalt størrelse: ${IMAGE_PRESETS[preset].recommended.width}×${IMAGE_PRESETS[preset].recommended.height} px.`
                            : ""}
                    </p>
                ) : null}

                {previews.length > 0 && !showSingleFrame && (
                    <ul
                        className={cn(
                            preset
                                ? "grid grid-cols-2 gap-3 sm:grid-cols-3"
                                : "flex flex-col gap-1",
                        )}
                    >
                        {previews.map((preview, i) => (
                            <DropzonePreviewItem
                                key={`${preview.file.name}-${preview.file.size}-${i}`}
                                preview={preview}
                                preset={preset}
                                disabled={disabled}
                                previewLabel={labels.previewLabel}
                                removeLabel={labels.removeLabel}
                                onPreview={() => setPreviewIndex(i)}
                                onRemove={() => removeAt(i)}
                            />
                        ))}
                    </ul>
                )}

                {previews.length > 0 && showSingleFrame && (
                    <div className="flex items-center justify-between gap-3">
                        {/* The name is the only part allowed to grow, so a long
                            filename is cut instead of wrapping the row onto a
                            second line and pushing the size out of view. */}
                        <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                            <span
                                className="truncate"
                                title={previews[0]?.file.name}
                            >
                                {previews[0]?.file.name}
                            </span>
                            {previews[0] ? (
                                <span className="shrink-0">
                                    {`· ${formatSize(previews[0].file.size)}`}
                                </span>
                            ) : null}
                        </span>
                        <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => removeAt(0)}
                            disabled={disabled}
                            className="shrink-0"
                        >
                            {labels.removeLabel}
                        </Button>
                    </div>
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
    preset?: ImagePresetName;
    disabled?: boolean;
    previewLabel: (name: string) => string;
    removeLabel: string;
    onPreview: () => void;
    onRemove: () => void;
}

function DropzonePreviewItem({
    preview,
    preset,
    disabled,
    previewLabel,
    removeLabel,
    onPreview,
    onRemove,
}: DropzonePreviewItemProps) {
    const { file, url } = preview;
    const type = formatType(file);

    // With a preset, each item is shown in the published crop rather than as a
    // row, so a batch upload is checked at a glance.
    if (preset) {
        return (
            <li className="flex flex-col gap-1">
                <ImagePresetFrame
                    preset={preset}
                    src={url}
                    alt={file.name}
                    overlay={
                        <>
                            <button
                                type="button"
                                onClick={onPreview}
                                aria-label={previewLabel(file.name)}
                                className="absolute inset-0 focus-visible:outline-none"
                            />
                            <Button
                                type="button"
                                size="icon-xs"
                                variant="secondary"
                                onClick={onRemove}
                                disabled={disabled}
                                aria-label={removeLabel}
                                className="absolute top-1 right-1"
                            >
                                <XIcon />
                            </Button>
                        </>
                    }
                />
                <span className="truncate text-xs text-muted-foreground">
                    {formatSize(file.size)}
                    {type ? ` · ${type}` : ""}
                </span>
            </li>
        );
    }

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
