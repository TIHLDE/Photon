import {
    CameraReceipt,
    CameraReceiptDescription,
    CameraReceiptTitle,
} from "@tihlde/ui/ui/camera-viewfinder";

/**
 * «Knips!» — the receipt for a photo just taken, with what is left. The photo
 * is a draft until it is submitted, so it says where it went.
 */
export function WrappedShotReceipt({
    shotsLeft,
    fromCameraRoll = false,
    className,
}: {
    shotsLeft: number;
    /** Valgt fra kamerarullen, ikke tatt med kameraet. */
    fromCameraRoll?: boolean;
    className?: string;
}) {
    return (
        <CameraReceipt className={className}>
            <CameraReceiptTitle>
                {fromCameraRoll
                    ? `Lagt til fra kamerarullen · ${shotsLeft} igjen`
                    : shotsLeft === 0
                      ? "Knips! Siste bilde!"
                      : `Knips! ${shotsLeft} igjen`}
            </CameraReceiptTitle>
            <CameraReceiptDescription>
                Lagt i Mine bilder – ikke sendt ennå
            </CameraReceiptDescription>
        </CameraReceipt>
    );
}
