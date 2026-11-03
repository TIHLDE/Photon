"use client";

import { useRender } from "@base-ui/react/use-render";
import * as React from "react";

import {
    FLASH_SAMPLE_SIZE_PX,
    FLASH_SETTLE_MS,
    meanLuminance,
    shouldFireFlash,
    type CameraFlashMode,
} from "#/lib/camera-flash";
import { createDoubleTapDetector } from "#/lib/double-tap";
import { cn } from "#/lib/utils";

export type CameraViewfinderState =
    | "requesting"
    | "live"
    | "denied"
    | "unavailable";

export type CameraFacingMode = "environment" | "user";

export type { CameraFlashMode };

export type CameraViewfinderHandle = {
    /**
     * The current frame as a JPEG, at the camera's own resolution. Lights the
     * shot first when the flash mode asks for it, so it takes a moment.
     */
    capture: () => Promise<File>;
};

type CameraViewfinderProps = Omit<React.ComponentProps<"div">, "ref"> & {
    ref?: React.Ref<CameraViewfinderHandle>;
    facingMode?: CameraFacingMode;
    /**
     * When `capture()` lights the shot: always, never, or when the preview is
     * dark. The back camera's torch where it has one, else a white screen.
     */
    flash?: CameraFlashMode;
    onStateChange?: (state: CameraViewfinderState) => void;
    /**
     * Two quick taps on the preview itself. Only fires while the camera is
     * live; taps on buttons and links over the preview never count.
     */
    onDoubleTap?: () => void;
};

/** A tap that starts on one of these belongs to the control, not the preview. */
const INTERACTIVE_SELECTOR = "button, a, [role=button]";

const JPEG_QUALITY = 0.9;

type TorchCapabilities = MediaTrackCapabilities & { torch?: boolean };

const sleep = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));

function setTorch(track: MediaStreamTrack, on: boolean) {
    return track.applyConstraints({
        advanced: [{ torch: on } as MediaTrackConstraintSet],
    });
}

/** The video's current frame as a JPEG file. */
async function grabFrame(video: HTMLVideoElement): Promise<File> {
    // The frame's own size, not the CSS box: the preview is cropped to fill
    // the screen, the photo is not.
    if (video.videoWidth === 0) throw new Error("Kameraet er ikke klart ennå.");
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Fikk ikke tatt bildet.");
    // Never mirrored, even when the preview of the front camera is: the photo
    // is what the camera saw.
    context.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    if (!blob) throw new Error("Fikk ikke tatt bildet.");
    return new File([blob], `wrapped-${Date.now()}.jpg`, {
        type: "image/jpeg",
    });
}

/** Mean luminance of the live preview, 0 to 1; 0 (dark) if it can't be read. */
function previewLuminance(video: HTMLVideoElement): number {
    try {
        const canvas = document.createElement("canvas");
        canvas.width = FLASH_SAMPLE_SIZE_PX;
        canvas.height = FLASH_SAMPLE_SIZE_PX;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) throw new Error("No 2d context");
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        return meanLuminance(
            context.getImageData(0, 0, canvas.width, canvas.height).data,
        );
    } catch (error) {
        console.error("Could not measure the light, assuming dark", error);
        return 0;
    }
}

function stopStream(stream: MediaStream) {
    for (const track of stream.getTracks()) track.stop();
}

/** Keeps the latest callback without making effects depend on it. */
function useLatest<T>(value: T) {
    const ref = React.useRef(value);
    React.useEffect(() => {
        ref.current = value;
    });
    return ref;
}

/**
 * A live camera preview, with `capture()` for the current frame.
 *
 * Presentational: it asks for the camera and shows it, nothing more. The
 * camera is only held while the page is visible — hiding the tab stops every
 * track, so the camera light goes off and other apps can use it, and coming
 * back starts it again. Children are drawn on top of the preview.
 */
function CameraViewfinder({
    ref,
    facingMode = "environment",
    flash = "auto",
    onStateChange,
    onDoubleTap,
    onPointerDown,
    onPointerUp,
    onPointerCancel,
    className,
    children,
    ...props
}: CameraViewfinderProps) {
    const videoRef = React.useRef<HTMLVideoElement>(null);
    const streamRef = React.useRef<MediaStream | null>(null);
    const [state, setState] =
        React.useState<CameraViewfinderState>("requesting");
    const [visible, setVisible] = React.useState(true);
    const onStateRef = useLatest(onStateChange);
    const flashRef = useLatest(flash);
    const facingModeRef = useLatest(facingMode);
    const [screenFlash, setScreenFlash] = React.useState(false);
    const onDoubleTapRef = useLatest(onDoubleTap);
    const stateRef = useLatest(state);
    const [doubleTap] = React.useState(createDoubleTapDetector);

    React.useEffect(() => {
        onStateRef.current?.(state);
    }, [state, onStateRef]);

    React.useEffect(() => {
        const update = () => setVisible(document.visibilityState === "visible");
        update();
        document.addEventListener("visibilitychange", update);
        return () => document.removeEventListener("visibilitychange", update);
    }, []);

    React.useEffect(() => {
        if (!visible) return;
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
            setState("unavailable");
            return;
        }

        let cancelled = false;
        // A restart (flip, tab back) breaks any half-finished double tap.
        doubleTap.reset();
        setState("requesting");
        navigator.mediaDevices
            .getUserMedia({
                video: {
                    facingMode: { ideal: facingMode },
                    width: { ideal: 1920 },
                    height: { ideal: 1920 },
                },
                audio: false,
            })
            .then((stream) => {
                if (cancelled) {
                    stopStream(stream);
                    return;
                }
                streamRef.current = stream;
                const video = videoRef.current;
                if (video) {
                    video.srcObject = stream;
                    video.play().catch((error: unknown) => {
                        console.error(
                            "Could not start the camera preview",
                            error,
                        );
                    });
                }
                setState("live");
            })
            .catch((error: unknown) => {
                if (cancelled) return;
                console.error("Could not open the camera", error);
                const name = error instanceof DOMException ? error.name : "";
                setState(
                    name === "NotAllowedError" || name === "SecurityError"
                        ? "denied"
                        : "unavailable",
                );
            });

        return () => {
            cancelled = true;
            if (streamRef.current) stopStream(streamRef.current);
            streamRef.current = null;
            if (videoRef.current) videoRef.current.srcObject = null;
        };
    }, [visible, facingMode, doubleTap]);

    React.useImperativeHandle(
        ref,
        () => ({
            async capture() {
                const video = videoRef.current;
                if (!video || video.videoWidth === 0) {
                    throw new Error("Kameraet er ikke klart ennå.");
                }
                const mode = flashRef.current;
                const fire = shouldFireFlash(
                    mode,
                    mode === "auto" ? previewLuminance(video) : 0,
                );
                if (!fire) return grabFrame(video);

                // A torch only on the back camera, and only where the track
                // reports one (iOS Safari never does). Anything else, or a
                // torch that refuses, lights the shot with the screen.
                const track = streamRef.current?.getVideoTracks()[0];
                const capabilities = track?.getCapabilities?.() as
                    | TorchCapabilities
                    | undefined;
                if (
                    track &&
                    facingModeRef.current === "environment" &&
                    capabilities?.torch === true
                ) {
                    let lit = false;
                    try {
                        try {
                            await setTorch(track, true);
                            lit = true;
                        } catch (error) {
                            console.warn(
                                "Could not switch the torch on, using the screen flash",
                                error,
                            );
                        }
                        if (lit) {
                            await sleep(FLASH_SETTLE_MS);
                            return await grabFrame(video);
                        }
                    } finally {
                        // Never leave the preview lit, whatever happened.
                        await setTorch(track, false).catch((error: unknown) => {
                            console.error(
                                "Could not switch the torch off",
                                error,
                            );
                        });
                    }
                }

                setScreenFlash(true);
                try {
                    await sleep(FLASH_SETTLE_MS);
                    return await grabFrame(video);
                } finally {
                    setScreenFlash(false);
                }
            },
        }),
        [flashRef, facingModeRef],
    );

    function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
        onPointerDown?.(event);
        const target = event.target instanceof Element ? event.target : null;
        // A second finger or a tap on a control breaks the pair.
        if (!event.isPrimary || target?.closest(INTERACTIVE_SELECTOR)) {
            doubleTap.reset();
            return;
        }
        doubleTap.down(event.clientX, event.clientY);
    }

    function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
        onPointerUp?.(event);
        if (!event.isPrimary) return;
        // Not live: the camera is starting or gone, so a flip would queue a
        // second getUserMedia on top of the first.
        if (stateRef.current !== "live") {
            doubleTap.reset();
            return;
        }
        if (doubleTap.up(event.clientX, event.clientY, event.timeStamp)) {
            onDoubleTapRef.current?.();
        }
    }

    function handlePointerCancel(event: React.PointerEvent<HTMLDivElement>) {
        onPointerCancel?.(event);
        doubleTap.reset();
    }

    return (
        <div
            data-slot="camera-viewfinder"
            data-state={state}
            className={cn(
                // `manipulation` keeps iOS from zooming on a double tap.
                "relative touch-manipulation overflow-hidden rounded-3xl bg-black text-white",
                className,
            )}
            {...props}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
        >
            <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                aria-hidden
                className={cn(
                    "absolute inset-0 size-full object-cover",
                    // A mirror is what people expect of a selfie preview.
                    facingMode === "user" && "-scale-x-100",
                )}
            />
            {children}
            {screenFlash ? <CameraScreenFlash /> : null}
        </div>
    );
}

/** A round 52 px control over or around the camera. */
function CameraControlButton({
    className,
    render,
    ...props
}: React.ComponentProps<"button"> & { render?: useRender.RenderProp }) {
    return useRender({
        render: render ?? <button type="button" />,
        props: {
            "data-slot": "camera-control-button",
            className: cn(
                "inline-flex size-13 shrink-0 cursor-pointer items-center justify-center rounded-full bg-black/45 text-white outline-none backdrop-blur-sm transition-opacity active:opacity-70 focus-visible:ring-3 focus-visible:ring-white/60 disabled:pointer-events-none disabled:opacity-40 aria-pressed:bg-white aria-pressed:text-black motion-reduce:transition-none [&_svg]:size-6",
                className,
            ),
            ...props,
        },
    });
}

/**
 * The square button beside the shutter that opens the phone's photo picker.
 * A web page cannot read the camera roll, so it holds an icon, not the
 * latest photo.
 */
function CameraRollButton({
    className,
    ...props
}: React.ComponentProps<"button">) {
    return (
        <button
            type="button"
            data-slot="camera-roll-button"
            className={cn(
                "inline-flex size-15 shrink-0 cursor-pointer items-center justify-center rounded-xl border-2 border-white/70 bg-black/45 text-white outline-none backdrop-blur-sm transition-opacity active:opacity-70 focus-visible:ring-3 focus-visible:ring-white/60 disabled:pointer-events-none disabled:opacity-40 motion-reduce:transition-none [&_svg]:size-7",
                className,
            )}
            {...props}
        />
    );
}

/** The big shutter: a white ring around a white disc. */
function CameraShutter({
    className,
    children,
    ...props
}: React.ComponentProps<"button">) {
    return (
        <button
            type="button"
            data-slot="camera-shutter"
            className={cn(
                "group/shutter relative inline-flex size-25 shrink-0 cursor-pointer items-center justify-center rounded-full border-[5px] border-white bg-transparent text-black outline-none focus-visible:ring-4 focus-visible:ring-white/60 disabled:cursor-default",
                className,
            )}
            {...props}
        >
            <span
                aria-hidden
                className="absolute inset-1.5 rounded-full bg-white transition-transform duration-100 group-active/shutter:scale-90 group-disabled/shutter:scale-90 group-disabled/shutter:opacity-60 motion-reduce:transition-none"
            />
            <span className="relative inline-flex [&_svg]:size-8">
                {children}
            </span>
        </button>
    );
}

/** The shots-left pill over the top of the preview. */
function CameraCounter({ className, ...props }: React.ComponentProps<"span">) {
    return (
        <span
            data-slot="camera-counter"
            className={cn(
                "inline-flex min-w-20 items-center justify-center rounded-full bg-black/60 px-4 py-1.5 font-mono text-2xl font-bold text-white tabular-nums backdrop-blur-sm",
                className,
            )}
            {...props}
        />
    );
}

/**
 * A white flash over the preview when a photo is taken. Give it a new `key`
 * per photo so it plays again; it fades out on its own. Left out entirely for
 * those who ask for reduced motion.
 */
function CameraFlash({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="camera-flash"
            aria-hidden
            className={cn(
                "pointer-events-none absolute inset-0 z-10 bg-white animate-out fade-out fill-mode-forwards duration-200 motion-reduce:hidden",
                className,
            )}
            {...props}
        />
    );
}

/**
 * A full-screen white light for a shot where the phone has no torch: the
 * front camera, or iOS. It is a light, not an animation, so reduced motion
 * keeps it. It never takes taps.
 */
function CameraScreenFlash({
    className,
    ...props
}: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="camera-screen-flash"
            aria-hidden
            className={cn(
                "pointer-events-none fixed inset-0 z-50 bg-white",
                className,
            )}
            {...props}
        />
    );
}

/**
 * The receipt for a photo: a check in a circle and a big line, over the top
 * of the preview. It never takes taps, so it can never get between the
 * member and the shutter.
 */
function CameraReceipt({
    className,
    children,
    ...props
}: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="camera-receipt"
            role="status"
            className={cn(
                "pointer-events-none flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-black shadow-lg animate-in fade-in slide-in-from-top-2 duration-150 motion-reduce:animate-none",
                className,
            )}
            {...props}
        >
            <span
                aria-hidden
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-black text-white"
            >
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="size-5"
                >
                    <path d="M5 12.5 10 17.5 19 7" />
                </svg>
            </span>
            <span className="flex min-w-0 flex-col">{children}</span>
        </div>
    );
}

function CameraReceiptTitle({
    className,
    ...props
}: React.ComponentProps<"span">) {
    return (
        <span
            data-slot="camera-receipt-title"
            className={cn("text-xl leading-tight font-bold", className)}
            {...props}
        />
    );
}

function CameraReceiptDescription({
    className,
    ...props
}: React.ComponentProps<"span">) {
    return (
        <span
            data-slot="camera-receipt-description"
            className={cn("text-sm text-black/70", className)}
            {...props}
        />
    );
}

/**
 * The camera page's backdrop: black, like every camera, in both themes. It
 * also switches what is inside it to the dark theme, so cards and alerts on
 * it stay readable and the white shutter stands out.
 */
function CameraScreen({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="camera-screen"
            className={cn("dark min-h-dvh bg-black text-white", className)}
            {...props}
        />
    );
}

function CameraTitle({ className, ...props }: React.ComponentProps<"h1">) {
    return (
        <h1
            data-slot="camera-title"
            className={cn(
                "min-w-0 truncate text-center text-base font-semibold",
                className,
            )}
            {...props}
        />
    );
}

export {
    CameraControlButton,
    CameraRollButton,
    CameraCounter,
    CameraFlash,
    CameraReceipt,
    CameraReceiptDescription,
    CameraReceiptTitle,
    CameraScreen,
    CameraScreenFlash,
    CameraShutter,
    CameraTitle,
    CameraViewfinder,
};
