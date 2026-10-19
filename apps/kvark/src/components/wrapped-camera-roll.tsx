import { Badge } from "@tihlde/ui/ui/badge";
import { Button } from "@tihlde/ui/ui/button";
import {
    CameraControlButton,
    CameraScreen,
    CameraTitle,
} from "@tihlde/ui/ui/camera-viewfinder";
import { Spinner } from "@tihlde/ui/ui/spinner";
import { Images, Plus, X } from "lucide-react";
import type { Ref } from "react";

/**
 * Telefonens egen bildevelger. Uten `capture` åpner den galleriet i stedet
 * for kameraet, og sida får bare bildet som velges — så ingen spør om
 * tilgang. Uten `multiple`: ett bilde per valg holder kvoten enkel.
 */
export function WrappedCameraRollInput({
    ref,
    onPick,
}: {
    ref: Ref<HTMLInputElement>;
    onPick: (file: File) => void;
}) {
    return (
        <input
            ref={ref}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
                const file = e.target.files?.[0];
                // Tøm feltet så samme bilde kan velges på nytt.
                e.target.value = "";
                if (file) onPick(file);
            }}
        />
    );
}

type WrappedCameraRollConfirmProps = {
    /** Bildet som er valgt, eller null mens det gjøres klart (HEIC). */
    src: string | null;
    shotsLeft: number;
    onCancel: () => void;
    onConfirm: () => void;
    onPickAnother: () => void;
};

/**
 * Siste stopp før et bilde fra kamerarullen koster et av bildene: bildet i
 * full størrelse og hva det koster. Avbryt koster ingenting.
 */
export function WrappedCameraRollConfirm({
    src,
    shotsLeft,
    onCancel,
    onConfirm,
    onPickAnother,
}: WrappedCameraRollConfirmProps) {
    return (
        <CameraScreen>
            <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-3 px-3 pt-[max(env(safe-area-inset-top),0.75rem)] pb-[max(env(safe-area-inset-bottom),0.75rem)]">
                <div className="grid grid-cols-[3.25rem_minmax(0,1fr)_3.25rem] items-center gap-2">
                    <CameraControlButton aria-label="Avbryt" onClick={onCancel}>
                        <X />
                    </CameraControlButton>
                    <CameraTitle>Legge til dette bildet?</CameraTitle>
                </div>

                <div className="relative flex min-h-[50dvh] flex-1 items-center justify-center">
                    {src ? (
                        <img
                            src={src}
                            alt="Bildet du valgte"
                            className="absolute inset-0 size-full object-contain"
                        />
                    ) : (
                        <Spinner className="size-8" />
                    )}
                    <Badge
                        variant="secondary"
                        className="absolute top-2 left-2"
                    >
                        <Images />
                        Fra kamerarullen
                    </Badge>
                </div>

                <Badge variant="secondary" className="self-center">
                    Bruker 1 av dine {shotsLeft}{" "}
                    {shotsLeft === 1 ? "bilde" : "bilder"} igjen
                </Badge>
                <Button
                    size="lg"
                    className="min-h-16 w-full"
                    disabled={!src}
                    onClick={onConfirm}
                >
                    <Plus />
                    Legg til i Mine bilder
                </Button>
                <Button
                    variant="ghost"
                    size="lg"
                    className="min-h-13 w-full"
                    onClick={onPickAnother}
                >
                    Velg et annet bilde
                </Button>
            </div>
        </CameraScreen>
    );
}
