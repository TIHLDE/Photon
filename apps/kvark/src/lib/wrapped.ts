export type CameraShortcut = {
    action: string;
    detail: string;
    /** «shoot» går til kameraet, «done» til Mine bilder. */
    kind: "shoot" | "done";
};

/**
 * What the shortcut to an open camera offers. The camera stays listed until
 * it closes: with shots left it is a photo; with a full film it points to
 * Mine bilder. The photos are sent to the organizer automatically when the
 * camera closes, so there is nothing to send in.
 */
export function cameraShortcut(camera: { shotsLeft: number }): CameraShortcut {
    if (camera.shotsLeft > 0) {
        return {
            action: "Ta bilde",
            detail: `${camera.shotsLeft} ${camera.shotsLeft === 1 ? "bilde" : "bilder"} igjen`,
            kind: "shoot",
        };
    }
    return {
        action: "Mine bilder",
        detail: "Alle bildene er tatt",
        kind: "done",
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
