/** Off never fires, on always, auto when the preview is dark. */
export type CameraFlashMode = "auto" | "on" | "off";

/** Mean luminance (0 to 1) below which the preview counts as dark. */
export const FLASH_DARK_LUMINANCE_THRESHOLD = 0.25;

/** Side of the square canvas the preview is shrunk to before measuring. */
export const FLASH_SAMPLE_SIZE_PX = 32;

/** How long the camera gets to adjust exposure after the light comes on. */
export const FLASH_SETTLE_MS = 400;

/**
 * Mean luminance of RGBA pixel data, from 0 (black) to 1 (white). Pure: the
 * caller draws the frame to a small canvas and hands over `getImageData().data`.
 */
export function meanLuminance(rgba: ArrayLike<number>): number {
    const pixels = Math.floor(rgba.length / 4);
    if (pixels === 0) return 0;
    let sum = 0;
    for (let i = 0; i < pixels * 4; i += 4) {
        // Rec. 709 weights: green counts most to the eye.
        sum +=
            0.2126 * (rgba[i] ?? 0) +
            0.7152 * (rgba[i + 1] ?? 0) +
            0.0722 * (rgba[i + 2] ?? 0);
    }
    return sum / pixels / 255;
}

/** Whether a shot should be lit. `luminance` is only read in auto mode. */
export function shouldFireFlash(
    mode: CameraFlashMode,
    luminance: number,
): boolean {
    if (mode === "on") return true;
    if (mode === "off") return false;
    return luminance < FLASH_DARK_LUMINANCE_THRESHOLD;
}
