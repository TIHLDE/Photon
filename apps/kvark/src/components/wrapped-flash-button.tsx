import {
    type CameraFlashMode,
    CameraControlButton,
} from "@tihlde/ui/ui/camera-viewfinder";
import { Zap, ZapOff } from "lucide-react";

const NEXT_MODE: Record<CameraFlashMode, CameraFlashMode> = {
    auto: "on",
    on: "off",
    off: "auto",
};

const LABEL: Record<CameraFlashMode, string> = {
    auto: "Blitz: auto",
    on: "Blitz: på",
    off: "Blitz: av",
};

type WrappedFlashButtonProps = {
    mode: CameraFlashMode;
    onChange: (mode: CameraFlashMode) => void;
};

/** One button that cycles the flash: auto, på, av. */
export function WrappedFlashButton({
    mode,
    onChange,
}: WrappedFlashButtonProps) {
    return (
        <CameraControlButton
            aria-label={LABEL[mode]}
            onClick={() => onChange(NEXT_MODE[mode])}
        >
            {mode === "off" ? (
                <ZapOff />
            ) : (
                <span className="relative inline-flex">
                    <Zap />
                    {mode === "auto" ? (
                        <span
                            aria-hidden
                            className="absolute -right-1 -bottom-1 text-xs leading-none font-bold"
                        >
                            A
                        </span>
                    ) : null}
                </span>
            )}
        </CameraControlButton>
    );
}
