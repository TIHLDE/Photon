/**
 * What the shortcut to an open camera offers. With shots left it is a photo;
 * with none left but drafts waiting, it is sending them in — the camera is
 * still listed as open precisely so the member can find their way back.
 */
export function cameraShortcut(camera: {
    shotsLeft: number;
    draftCount: number;
}): { action: string; detail: string } {
    if (camera.shotsLeft === 0 && camera.draftCount > 0) {
        return {
            action: "Send inn",
            detail: `${camera.draftCount} ikke sendt`,
        };
    }
    return {
        action: "Ta bilde",
        detail: `${camera.shotsLeft} ${camera.shotsLeft === 1 ? "bilde" : "bilder"} igjen`,
    };
}
