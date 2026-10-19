import { formatInOslo } from "#/lib/date";

/** Hvor lenge før kameraet stenger utkastene begynner å mase. */
const DRAFT_WARNING_MS = 30 * 60 * 1000;

/**
 * Om varselet om usendte bilder skal vises. Utkast som ikke er sendt inn når
 * kameraet stenger, slettes, så den siste halvtimen sier vi fra.
 */
export function isDraftWarning(
    closesAt: string,
    draftCount: number,
    now: Date,
): boolean {
    return (
        draftCount > 0 &&
        now.getTime() >= new Date(closesAt).getTime() - DRAFT_WARNING_MS &&
        now.getTime() < new Date(closesAt).getTime()
    );
}

export type CameraShortcut = {
    action: string;
    detail: string;
    /** «Ta bilde» går til kameraet, «Send inn» til Mine bilder. */
    target: "camera" | "mine";
    /** Usendte bilder slettes snart: vises i varselfarge. */
    warning: boolean;
};

/**
 * What the shortcut to an open camera offers. With shots left it is a photo;
 * with none left but drafts waiting, it is sending them in — the camera is
 * still listed as open precisely so the member can find their way back. The
 * last half hour before drafts are discarded, sending them in wins over
 * taking another photo, whatever is left.
 */
export function cameraShortcut(
    camera: { shotsLeft: number; draftCount: number; closesAt: string },
    now: Date,
): CameraShortcut {
    if (isDraftWarning(camera.closesAt, camera.draftCount, now)) {
        return {
            action: "Send inn",
            detail: `${camera.draftCount} ikke sendt før ${formatInOslo(camera.closesAt, "HH:mm")}`,
            target: "mine",
            warning: true,
        };
    }
    if (camera.shotsLeft === 0 && camera.draftCount > 0) {
        return {
            action: "Send inn",
            detail: `${camera.draftCount} ikke sendt`,
            target: "mine",
            warning: false,
        };
    }
    return {
        action: "Ta bilde",
        detail: `${camera.shotsLeft} ${camera.shotsLeft === 1 ? "bilde" : "bilder"} igjen`,
        target: "camera",
        warning: false,
    };
}
