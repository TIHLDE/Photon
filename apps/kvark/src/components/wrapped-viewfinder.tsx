import {
    type CameraFacingMode,
    type CameraViewfinderHandle,
    type CameraViewfinderState,
    CameraControlButton,
    CameraCounter,
    CameraShutter,
    CameraViewfinder,
} from "@tihlde/ui/ui/camera-viewfinder";
import { Button } from "@tihlde/ui/ui/button";
import { Spinner } from "@tihlde/ui/ui/spinner";
import { SwitchCamera } from "lucide-react";
import type { Ref } from "react";

import {
    WrappedUploadStatus,
    type WrappedUploadState,
} from "#/components/wrapped-camera";

type WrappedViewfinderProps = {
    viewfinderRef: Ref<CameraViewfinderHandle>;
    facingMode: CameraFacingMode;
    torch: boolean;
    viewfinderState: CameraViewfinderState;
    shotsLeft: number;
    shotsPerPerson: number;
    uploadState: WrappedUploadState;
    onStateChange: (state: CameraViewfinderState) => void;
    onTorchSupportChange: (supported: boolean) => void;
    onShutter: () => void;
    onSwitchCamera: () => void;
    /** Leave the live camera for the phone's own, through a file input. */
    onUseSystemCamera: () => void;
    onRetry?: () => void;
};

/**
 * The live camera: the preview with the counter over it, and the shutter
 * row below. One tap on the shutter is one photo — no system camera screen,
 * no «Bruk bilde».
 */
export function WrappedViewfinder({
    viewfinderRef,
    facingMode,
    torch,
    viewfinderState,
    shotsLeft,
    shotsPerPerson,
    uploadState,
    onStateChange,
    onTorchSupportChange,
    onShutter,
    onSwitchCamera,
    onUseSystemCamera,
    onRetry,
}: WrappedViewfinderProps) {
    const busy =
        uploadState.status === "converting" ||
        uploadState.status === "uploading";

    return (
        <>
            <CameraViewfinder
                ref={viewfinderRef}
                facingMode={facingMode}
                torch={torch}
                onStateChange={onStateChange}
                onTorchSupportChange={onTorchSupportChange}
                className="min-h-[50dvh] flex-1"
            >
                <div className="absolute inset-x-0 top-3 flex justify-center">
                    <CameraCounter
                        aria-label={`${shotsLeft} av ${shotsPerPerson} bilder igjen`}
                    >
                        {shotsLeft} / {shotsPerPerson}
                    </CameraCounter>
                </div>
                {/* Et spørsmål om tilgang som lukkes uten svar kan bli stående
                 * ubesvart for alltid, så veien ut står her hele tiden. */}
                {viewfinderState === "requesting" ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-4">
                        <Spinner className="size-8" />
                        <Button variant="secondary" onClick={onUseSystemCamera}>
                            Bruk telefonens kamera i stedet
                        </Button>
                    </div>
                ) : null}
            </CameraViewfinder>

            {/* Plassen over knapperaden: status for siste bilde nå, og
             * «Mine bilder» (#919) senere. */}
            <div className="flex flex-col gap-2" aria-live="polite">
                <WrappedUploadStatus
                    uploadState={uploadState}
                    onRetry={onRetry}
                />
            </div>

            <div className="grid grid-cols-3 items-center">
                {/* Kamerarullen (#918) kommer her. */}
                <div className="size-13" aria-hidden />
                <div className="flex justify-center">
                    <CameraShutter
                        aria-label={busy ? "Lagrer bildet" : "Ta bilde"}
                        disabled={busy || viewfinderState !== "live"}
                        onClick={onShutter}
                    >
                        {busy ? <Spinner /> : null}
                    </CameraShutter>
                </div>
                <div className="flex justify-end">
                    <CameraControlButton
                        aria-label="Bytt kamera"
                        onClick={onSwitchCamera}
                        disabled={busy}
                    >
                        <SwitchCamera />
                    </CameraControlButton>
                </div>
            </div>
        </>
    );
}
