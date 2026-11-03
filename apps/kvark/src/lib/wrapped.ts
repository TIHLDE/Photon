import { formatInOslo } from "#/lib/date";

/** Hvor lenge før kameraet stenger bildene begynner å mase. */
const DRAFT_WARNING_MS = 30 * 60 * 1000;

/**
 * Om varselet om bilder som snart sendes skal vises. Bildene går automatisk
 * til arrangøren når kameraet stenger, så den siste halvtimen sier vi fra, slik
 * at de som vil slette noe rekker det.
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
    /** «shoot» går til kameraet, «submit» og «done» til Mine bilder. */
    kind: "shoot" | "submit" | "done";
    /** Bildene sendes snart til arrangøren: vises i varselfarge. */
    warning: boolean;
};

/**
 * What the shortcut to an open camera offers. The camera stays listed until
 * it closes: with shots left it is a photo; with none left but drafts waiting,
 * it points to Mine bilder, where they can be reviewed; with a full film and
 * nothing waiting it points there too. The last half hour before the drafts
 * are sent to the organizer, reviewing them wins over taking another photo,
 * whatever is left.
 */
export function cameraShortcut(
    camera: { shotsLeft: number; draftCount: number; closesAt: string },
    now: Date,
): CameraShortcut {
    if (isDraftWarning(camera.closesAt, camera.draftCount, now)) {
        return {
            action: "Se over",
            detail: `${camera.draftCount} sendes kl. ${formatInOslo(camera.closesAt, "HH:mm")}`,
            kind: "submit",
            warning: true,
        };
    }
    if (camera.shotsLeft > 0) {
        return {
            action: "Ta bilde",
            detail: `${camera.shotsLeft} ${camera.shotsLeft === 1 ? "bilde" : "bilder"} igjen`,
            kind: "shoot",
            warning: false,
        };
    }
    if (camera.draftCount > 0) {
        return {
            action: "Mine bilder",
            detail: `${camera.draftCount} sendes når kameraet stenger`,
            kind: "submit",
            warning: false,
        };
    }
    return {
        action: "Mine bilder",
        detail: "Alle bildene er tatt",
        kind: "done",
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
