import { Alert, AlertDescription, AlertTitle } from "@tihlde/ui/ui/alert";
import { CameraOff } from "lucide-react";

/**
 * Why the live camera is not there, above the file-input fallback. When the
 * member has said no, how to say yes again — the browser never asks twice.
 */
export function WrappedCameraFallback({
    reason,
}: {
    reason: "denied" | "unavailable";
}) {
    if (reason === "unavailable") {
        return (
            <Alert>
                <CameraOff />
                <AlertTitle>Nettleseren får ikke bruke kameraet</AlertTitle>
                <AlertDescription>
                    Du kan fortsatt ta bilder med telefonens eget kamera.
                </AlertDescription>
            </Alert>
        );
    }

    return (
        <Alert>
            <CameraOff />
            <AlertTitle>Kameraet er blokkert</AlertTitle>
            <AlertDescription className="flex flex-col gap-2">
                <span>
                    Du kan ta bilder med telefonens eget kamera under, eller gi
                    siden tilgang og laste den på nytt:
                </span>
                <ul className="flex flex-col gap-1">
                    <li>
                        iPhone (Safari): trykk på aA i adresselinjen &gt;
                        Nettstedsinnstillinger &gt; Kamera &gt; Tillat.
                    </li>
                    <li>
                        Android (Chrome): trykk på ikonet til venstre for
                        adressen &gt; Tillatelser &gt; Kamera &gt; Tillat.
                    </li>
                </ul>
            </AlertDescription>
        </Alert>
    );
}
