"use client";

import { useRender } from "@base-ui/react/use-render";
import * as React from "react";

import { cn } from "#/lib/utils";

export type CameraViewfinderState =
    | "requesting"
    | "live"
    | "denied"
    | "unavailable";

export type CameraFacingMode = "environment" | "user";

export type CameraViewfinderHandle = {
    /** The current frame as a JPEG, at the camera's own resolution. */
    capture: () => Promise<File>;
};

type CameraViewfinderProps = Omit<React.ComponentProps<"div">, "ref"> & {
    ref?: React.Ref<CameraViewfinderHandle>;
    facingMode?: CameraFacingMode;
    /** Turn the torch on. Ignored where the camera has none. */
    torch?: boolean;
    onStateChange?: (state: CameraViewfinderState) => void;
    /** Whether the running camera has a torch; false until it is live. */
    onTorchSupportChange?: (supported: boolean) => void;
};

const JPEG_QUALITY = 0.9;

type TorchCapabilities = MediaTrackCapabilities & { torch?: boolean };

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
    torch = false,
    onStateChange,
    onTorchSupportChange,
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
    const onTorchRef = useLatest(onTorchSupportChange);

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
                const track = stream.getVideoTracks()[0];
                const capabilities = track?.getCapabilities?.() as
                    | TorchCapabilities
                    | undefined;
                onTorchRef.current?.(capabilities?.torch === true);
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
            onTorchRef.current?.(false);
        };
    }, [visible, facingMode, onTorchRef]);

    // Applied again whenever the camera comes back live: a restarted track
    // starts with the torch off.
    React.useEffect(() => {
        if (state !== "live") return;
        const track = streamRef.current?.getVideoTracks()[0];
        const capabilities = track?.getCapabilities?.() as
            | TorchCapabilities
            | undefined;
        if (!track || capabilities?.torch !== true) return;
        track
            .applyConstraints({
                advanced: [{ torch } as MediaTrackConstraintSet],
            })
            .catch((error: unknown) => {
                console.error("Could not switch the torch", error);
            });
    }, [torch, state]);

    React.useImperativeHandle(
        ref,
        () => ({
            async capture() {
                const video = videoRef.current;
                // The frame's own size, not the CSS box: the preview is
                // cropped to fill the screen, the photo is not.
                if (!video || video.videoWidth === 0) {
                    throw new Error("Kameraet er ikke klart ennå.");
                }
                const canvas = document.createElement("canvas");
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const context = canvas.getContext("2d");
                if (!context) throw new Error("Fikk ikke tatt bildet.");
                // Never mirrored, even when the preview of the front camera
                // is: the photo is what the camera saw.
                context.drawImage(video, 0, 0);
                const blob = await new Promise<Blob | null>((resolve) =>
                    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
                );
                if (!blob) throw new Error("Fikk ikke tatt bildet.");
                return new File([blob], `wrapped-${Date.now()}.jpg`, {
                    type: "image/jpeg",
                });
            },
        }),
        [],
    );

    return (
        <div
            data-slot="camera-viewfinder"
            data-state={state}
            className={cn(
                "relative overflow-hidden rounded-3xl bg-black text-white",
                className,
            )}
            {...props}
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
    CameraScreen,
    CameraShutter,
    CameraTitle,
    CameraViewfinder,
};
