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
    className,
}: {
    shotsLeft: number;
    className?: string;
}) {
    return (
        <CameraReceipt className={className}>
            <CameraReceiptTitle>
                {shotsLeft === 0
                    ? "Knips! Siste bilde!"
                    : `Knips! ${shotsLeft} igjen`}
            </CameraReceiptTitle>
            <CameraReceiptDescription>
                Lagt i Mine bilder – ikke sendt ennå
            </CameraReceiptDescription>
        </CameraReceipt>
    );
}
