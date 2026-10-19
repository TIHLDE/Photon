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

/**
 * «om 1 t 23 min», «om 2 d 4 t», «om 45 s» — hvor lenge til kameraet åpner.
 * To enheter holder: den som venter, vil vite omtrent, ikke på sekundet.
 */
export function formatOpensIn(opensAt: string, now: Date): string {
    const totalSeconds = Math.max(
        Math.ceil((new Date(opensAt).getTime() - now.getTime()) / 1000),
        0,
    );
    if (totalSeconds === 0) return "Åpner nå";
    const days = Math.floor(totalSeconds / 86_400);
    const hours = Math.floor((totalSeconds % 86_400) / 3_600);
    const minutes = Math.floor((totalSeconds % 3_600) / 60);
    if (days > 0) return hours > 0 ? `om ${days} d ${hours} t` : `om ${days} d`;
    if (hours > 0) {
        return minutes > 0 ? `om ${hours} t ${minutes} min` : `om ${hours} t`;
    }
    if (minutes > 0) return `om ${minutes} min`;
    return `om ${totalSeconds} s`;
}
