"use client";

import * as React from "react";
import { clamp as clampNumber } from "es-toolkit";
import { Minus, Plus, RotateCcw } from "lucide-react";

import { Button } from "#/components/ui/button";
import { Slider } from "#/components/ui/slider";
import { Spinner } from "#/components/ui/spinner";
import { cn } from "#/lib/utils";

/** Widest the crop is written out, in pixels. */
const DEFAULT_OUTPUT_WIDTH = 1600;
/** How far past «fyller rammen» the user may zoom in. */
const MAX_ZOOM = 4;
/** Pixels one arrow-key press moves the image, in crop-box coordinates. */
const KEYBOARD_STEP = 12;

export type ImageCropperLabels = {
    instructions: string;
    zoomLabel: string;
    zoomOut: string;
    zoomIn: string;
    reset: string;
    cropRegion: string;
    loading: string;
    failed: string;
};

const defaultLabels: ImageCropperLabels = {
    instructions: "Dra for å flytte bildet, og bruk glidebryteren for å zoome.",
    zoomLabel: "Zoom",
    zoomOut: "Zoom ut",
    zoomIn: "Zoom inn",
    reset: "Tilbakestill",
    cropRegion: "Beskjæring av bilde",
    loading: "Laster bilde …",
    failed: "Fikk ikke åpnet bildet. Prøv en annen fil.",
};

export type ImageCropperHandle = {
    /**
     * The visible frame, rendered to a WebP file.
     *
     * Returns `null` before the image has loaded, so callers can keep their
     * confirm button disabled without duplicating the loading state.
     */
    getCroppedFile: () => Promise<File | null>;
};

export interface ImageCropperProps {
    /**
     * Gir tilgang til {@link ImageCropperHandle}. Heter ikke `ref`, fordi
     * JSX-transformen appen bygges med plukker `ref` ut av props før
     * komponenten ser den.
     */
    controlRef?: React.Ref<ImageCropperHandle>;
    /** Image being cropped. Replacing it resets pan and zoom. */
    file: File;
    /** Width divided by height of the crop. */
    aspect?: number;
    /** A circle only changes the guide: the file is still a rectangle. */
    shape?: "rect" | "circle";
    /** Upper bound on the produced width. Small sources are not upscaled. */
    outputWidth?: number;
    /** Fires whenever the image finishes loading, or fails to. */
    onReadyChange?: (ready: boolean) => void;
    labels?: Partial<ImageCropperLabels>;
    className?: string;
}

type Transform = {
    /** Rendered pixels per source pixel. */
    scale: number;
    /** Image top-left corner, in crop-box coordinates. */
    x: number;
    y: number;
};

/**
 * Crop editor: pan by dragging, zoom by slider, wheel or pinch.
 *
 * The image is never allowed to leave the crop box — clamping the offsets on
 * every interaction is what keeps a transparent wedge from appearing in the
 * corner of the finished picture.
 *
 * The result is produced on demand through the ref rather than on every
 * pointer move: encoding a WebP per frame would make dragging stutter, and
 * only the crop the user confirms is ever needed.
 */
export function ImageCropper({
    controlRef,
    file,
    aspect = 1,
    shape = "rect",
    outputWidth = DEFAULT_OUTPUT_WIDTH,
    onReadyChange,
    labels: userLabels,
    className,
}: ImageCropperProps) {
    const labels = React.useMemo(
        () => ({ ...defaultLabels, ...userLabels }),
        [userLabels],
    );

    const instructionsId = React.useId();
    const stageRef = React.useRef<HTMLDivElement>(null);
    const boxRef = React.useRef<HTMLDivElement>(null);
    const imageRef = React.useRef<HTMLImageElement | null>(null);
    const pointersRef = React.useRef(
        new Map<number, { x: number; y: number }>(),
    );
    const pinchRef = React.useRef<{ distance: number; scale: number } | null>(
        null,
    );

    const [objectUrl, setObjectUrl] = React.useState<string | null>(null);
    const [natural, setNatural] = React.useState<{
        width: number;
        height: number;
    } | null>(null);
    const [failed, setFailed] = React.useState(false);
    const [box, setBox] = React.useState({ width: 0, height: 0 });
    const [transform, setTransform] = React.useState<Transform>({
        scale: 1,
        x: 0,
        y: 0,
    });

    // Object URLs outlive the component unless revoked, and a member who tries
    // three pictures before settling would leak all three.
    React.useEffect(() => {
        const url = URL.createObjectURL(file);
        setObjectUrl(url);
        setNatural(null);
        setFailed(false);
        return () => URL.revokeObjectURL(url);
    }, [file]);

    // The box is fluid, so its size only exists at runtime. Every
    // clamp below is in these coordinates, which is why they have to be
    // remeasured when the dialog resizes.
    React.useEffect(() => {
        const element = boxRef.current;
        if (!element) return;

        const observer = new ResizeObserver(([entry]) => {
            setBox({
                width: entry?.contentRect.width ?? 0,
                height: entry?.contentRect.height ?? 0,
            });
        });
        observer.observe(element);

        return () => observer.disconnect();
    }, []);

    const isReady = natural !== null && box.width > 0 && !failed;

    React.useEffect(() => {
        onReadyChange?.(isReady);
    }, [isReady, onReadyChange]);

    /** Smallest scale that still covers the crop box on both axes. */
    const minScale = React.useMemo(() => {
        if (!natural || box.width === 0) return 1;
        return Math.max(box.width / natural.width, box.height / natural.height);
    }, [natural, box]);

    const clamp = React.useCallback(
        (next: Transform): Transform => {
            if (!natural || box.width === 0) return next;

            const scale = clampNumber(
                next.scale,
                minScale,
                minScale * MAX_ZOOM,
            );
            const width = natural.width * scale;
            const height = natural.height * scale;

            return {
                scale,
                x: clampNumber(next.x, box.width - width, 0),
                y: clampNumber(next.y, box.height - height, 0),
            };
        },
        [natural, box, minScale],
    );

    /** Centre the image at the tightest fit — what the crop opens on. */
    const reset = React.useCallback(() => {
        if (!natural || box.width === 0) return;
        setTransform({
            scale: minScale,
            x: (box.width - natural.width * minScale) / 2,
            y: (box.height - natural.height * minScale) / 2,
        });
    }, [natural, box, minScale]);

    React.useEffect(() => {
        reset();
    }, [reset]);

    /** Zoom around a fixed point, so the spot under the cursor stays put. */
    const zoomAround = React.useCallback(
        (nextScale: number, focusX: number, focusY: number) => {
            setTransform((current) => {
                const scale = Math.min(
                    Math.max(nextScale, minScale),
                    minScale * MAX_ZOOM,
                );
                const ratio = scale / current.scale;
                return clamp({
                    scale,
                    x: focusX - (focusX - current.x) * ratio,
                    y: focusY - (focusY - current.y) * ratio,
                });
            });
        },
        [clamp, minScale],
    );

    const zoomToCentre = React.useCallback(
        (nextScale: number) => {
            zoomAround(nextScale, box.width / 2, box.height / 2);
        },
        [zoomAround, box],
    );

    function pointerDistance() {
        const [a, b] = [...pointersRef.current.values()];
        if (!a || !b) return 0;
        return Math.hypot(a.x - b.x, a.y - b.y);
    }

    function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
        if (!isReady) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        pointersRef.current.set(event.pointerId, {
            x: event.clientX,
            y: event.clientY,
        });
        if (pointersRef.current.size === 2) {
            pinchRef.current = {
                distance: pointerDistance(),
                scale: transform.scale,
            };
        }
    }

    function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
        const pointers = pointersRef.current;
        const previous = pointers.get(event.pointerId);
        if (!previous || !isReady) return;

        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

        // Two fingers down means pinch-zoom about the midpoint between them;
        // panning with the same gesture would fight the zoom.
        if (pointers.size === 2 && pinchRef.current) {
            const distance = pointerDistance();
            if (distance === 0) return;

            const rect = boxRef.current?.getBoundingClientRect();
            const [a, b] = [...pointers.values()];
            if (!rect || !a || !b) return;

            const midX = (a.x + b.x) / 2 - rect.left;
            const midY = (a.y + b.y) / 2 - rect.top;
            const ratio = distance / pinchRef.current.distance;
            zoomAround(pinchRef.current.scale * ratio, midX, midY);
            return;
        }

        const dx = event.clientX - previous.x;
        const dy = event.clientY - previous.y;
        setTransform((current) =>
            clamp({ ...current, x: current.x + dx, y: current.y + dy }),
        );
    }

    function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
        pointersRef.current.delete(event.pointerId);
        if (pointersRef.current.size < 2) pinchRef.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
    }

    // Bound natively rather than through React: the passive default on wheel
    // listeners makes `preventDefault()` a no-op, so zooming would scroll the
    // dialog at the same time.
    React.useEffect(() => {
        const element = stageRef.current;
        if (!element || !isReady) return;

        function onWheel(event: WheelEvent) {
            event.preventDefault();
            const rect = boxRef.current?.getBoundingClientRect();
            if (!rect) return;
            setTransform((current) => {
                const factor = Math.exp(-event.deltaY / 400);
                const scale = Math.min(
                    Math.max(current.scale * factor, minScale),
                    minScale * MAX_ZOOM,
                );
                const focusX = event.clientX - rect.left;
                const focusY = event.clientY - rect.top;
                const ratio = scale / current.scale;
                return clamp({
                    scale,
                    x: focusX - (focusX - current.x) * ratio,
                    y: focusY - (focusY - current.y) * ratio,
                });
            });
        }

        element.addEventListener("wheel", onWheel, { passive: false });
        return () => element.removeEventListener("wheel", onWheel);
    }, [isReady, clamp, minScale]);

    function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
        if (!isReady) return;

        const pan: Record<string, [number, number]> = {
            ArrowLeft: [-KEYBOARD_STEP, 0],
            ArrowRight: [KEYBOARD_STEP, 0],
            ArrowUp: [0, -KEYBOARD_STEP],
            ArrowDown: [0, KEYBOARD_STEP],
        };

        const step = pan[event.key];
        if (step) {
            event.preventDefault();
            setTransform((current) =>
                clamp({
                    ...current,
                    x: current.x + step[0],
                    y: current.y + step[1],
                }),
            );
            return;
        }

        if (event.key === "+" || event.key === "=") {
            event.preventDefault();
            zoomToCentre(transform.scale * 1.15);
        } else if (event.key === "-" || event.key === "_") {
            event.preventDefault();
            zoomToCentre(transform.scale / 1.15);
        }
    }

    React.useImperativeHandle(
        controlRef,
        () => ({
            async getCroppedFile() {
                const image = imageRef.current;
                if (!image || !natural || box.width === 0 || failed) {
                    return null;
                }

                // The crop box maps straight back onto the source: its
                // top-left corner sits at `-offset / scale` in image pixels,
                // and it is `box / scale` wide.
                const sourceWidth = box.width / transform.scale;
                const sourceHeight = box.height / transform.scale;
                const width = Math.round(Math.min(outputWidth, sourceWidth));

                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = Math.round(width / aspect);
                const context = canvas.getContext("2d");
                if (!context) return null;

                context.imageSmoothingQuality = "high";
                context.drawImage(
                    image,
                    -transform.x / transform.scale,
                    -transform.y / transform.scale,
                    sourceWidth,
                    sourceHeight,
                    0,
                    0,
                    canvas.width,
                    canvas.height,
                );

                const blob = await new Promise<Blob | null>((resolve) =>
                    canvas.toBlob(
                        (result) => resolve(result),
                        "image/webp",
                        0.92,
                    ),
                );
                if (!blob) return null;

                // Safari cannot encode WebP and hands back a PNG, so the name
                // and type follow the blob rather than what was asked for.
                const extension = blob.type.split("/")[1];
                const baseName = file.name.replace(/\.[^.]+$/, "");

                // A real `File`, not a named `Blob`: schemas that check
                // `instanceof File` reject the latter, and it uploads as
                // "blob" with no extension.
                return new File([blob], `${baseName}.${extension}`, {
                    type: blob.type,
                });
            },
        }),
        [natural, box, transform, outputWidth, aspect, file, failed],
    );

    const zoom = transform.scale / minScale;

    return (
        <div className={cn("flex flex-col gap-4", className)}>
            <div
                ref={stageRef}
                role="application"
                aria-label={labels.cropRegion}
                aria-describedby={instructionsId}
                tabIndex={isReady ? 0 : -1}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onKeyDown={handleKeyDown}
                className={cn(
                    "relative w-full touch-none overflow-hidden rounded-lg bg-muted select-none",
                    "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                    // A circle already shows what is cut away in its corners;
                    // a rectangle needs a margin to show the same.
                    shape === "rect" && "px-6 py-12",
                    isReady ? "cursor-grab active:cursor-grabbing" : null,
                )}
            >
                <div
                    ref={boxRef}
                    className="relative mx-auto w-full"
                    style={{
                        aspectRatio: aspect,
                        maxWidth: `calc(55vh * ${aspect})`,
                    }}
                >
                    {objectUrl ? (
                        <img
                            ref={imageRef}
                            src={objectUrl}
                            alt=""
                            draggable={false}
                            onLoad={(event) => {
                                const target = event.currentTarget;
                                setNatural({
                                    width: target.naturalWidth,
                                    height: target.naturalHeight,
                                });
                                setFailed(false);
                            }}
                            onError={() => setFailed(true)}
                            style={
                                natural
                                    ? {
                                          width:
                                              natural.width * transform.scale,
                                          height:
                                              natural.height * transform.scale,
                                          transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
                                      }
                                    : undefined
                            }
                            className={cn(
                                "absolute top-0 left-0 max-w-none origin-top-left",
                                natural ? "visible" : "invisible",
                            )}
                        />
                    ) : null}

                    {/* The frame is drawn on top rather than by clipping the
                        image, so the part being cut away stays visible — that
                        context is what makes the crop easy to judge. */}
                    <div
                        aria-hidden
                        className={cn(
                            "pointer-events-none absolute inset-0 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] ring-2 ring-white/70 ring-inset",
                            shape === "circle" && "rounded-full",
                        )}
                    />
                </div>

                {!isReady && !failed ? (
                    <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-white">
                        <Spinner />
                        {labels.loading}
                    </div>
                ) : null}

                {failed ? (
                    <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-white">
                        {labels.failed}
                    </div>
                ) : null}
            </div>

            <div className="flex items-center gap-3">
                <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    aria-label={labels.zoomOut}
                    disabled={!isReady}
                    onClick={() => zoomToCentre(transform.scale / 1.2)}
                >
                    <Minus />
                </Button>
                <Slider
                    aria-label={labels.zoomLabel}
                    disabled={!isReady}
                    min={1}
                    max={MAX_ZOOM}
                    step={0.01}
                    value={zoom}
                    onValueChange={(next) => {
                        const value = Array.isArray(next) ? next[0] : next;
                        if (value !== undefined) zoomToCentre(minScale * value);
                    }}
                    className="flex-1"
                />
                <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    aria-label={labels.zoomIn}
                    disabled={!isReady}
                    onClick={() => zoomToCentre(transform.scale * 1.2)}
                >
                    <Plus />
                </Button>
                <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={!isReady}
                    onClick={reset}
                >
                    <RotateCcw />
                    {labels.reset}
                </Button>
            </div>

            <p id={instructionsId} className="text-xs text-muted-foreground">
                {labels.instructions}
            </p>
        </div>
    );
}
