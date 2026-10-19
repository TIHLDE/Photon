import {
    type CameraFacingMode,
    type CameraViewfinderHandle,
    type CameraViewfinderState,
    CameraControlButton,
    CameraCounter,
    CameraFlash,
    CameraShutter,
    CameraViewfinder,
} from "@tihlde/ui/ui/camera-viewfinder";
import { Button } from "@tihlde/ui/ui/button";
import { Spinner } from "@tihlde/ui/ui/spinner";
import { SwitchCamera } from "lucide-react";
import type { ReactNode, Ref } from "react";

type WrappedViewfinderProps = {
    viewfinderRef: Ref<CameraViewfinderHandle>;
    facingMode: CameraFacingMode;
    torch: boolean;
    viewfinderState: CameraViewfinderState;
    shotsLeft: number;
    shotsPerPerson: number;
    /** A new number per photo plays the flash again; null before the first. */
    flashKey: number | null;
    /** The receipt for the last photo, over the top of the preview. */
    receipt?: ReactNode;
    /** Photos waiting for the network, above the shutter row. */
    waiting?: ReactNode;
    onStateChange: (state: CameraViewfinderState) => void;
    onTorchSupportChange: (supported: boolean) => void;
    onShutter: () => void;
    onSwitchCamera: () => void;
    /** Leave the live camera for the phone's own, through a file input. */
    onUseSystemCamera: () => void;
    /** «Mine bilder», shown above the shutter row once there are photos. */
    myPhotos?: ReactNode;
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
    flashKey,
    receipt,
    waiting,
    onStateChange,
    onTorchSupportChange,
    onShutter,
    onSwitchCamera,
    onUseSystemCamera,
    myPhotos,
}: WrappedViewfinderProps) {
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
                {flashKey !== null ? <CameraFlash key={flashKey} /> : null}
                <div
                    className="absolute inset-x-3 top-16 z-20 flex justify-center"
                    aria-live="polite"
                >
                    {receipt}
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

            {/* Plassen over knapperaden: bilder som venter på nett, og «Mine
             * bilder» — den eneste veien til innsending her, siden sida ikke
             * har bunnlinje. */}
            <div className="flex flex-col gap-2">
                {waiting}
                {myPhotos}
            </div>

            <div className="grid grid-cols-3 items-center">
                {/* Kamerarullen (#918) kommer her. */}
                <div className="size-13" aria-hidden />
                <div className="flex justify-center">
                    {/* Låses aldri mens et bilde lastes opp — bare når det
                     * ikke er flere igjen. */}
                    <CameraShutter
                        aria-label="Ta bilde"
                        disabled={shotsLeft <= 0 || viewfinderState !== "live"}
                        onClick={onShutter}
                    />
                </div>
                <div className="flex justify-end">
                    <CameraControlButton
                        aria-label="Bytt kamera"
                        onClick={onSwitchCamera}
                    >
                        <SwitchCamera />
                    </CameraControlButton>
                </div>
            </div>
        </>
    );
}
