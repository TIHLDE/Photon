/**
 * Client-side image compression, applied before a file is ever uploaded.
 *
 * The API re-encodes every image as well, and that server pass is what
 * *guarantees* optimized assets. This one exists for the upload itself: a 12 MB
 * phone photo on conference wifi is a slow, failure-prone request, and shrinking
 * it in a worker first turns that into well under a megabyte.
 */

import { convertHeicToJpeg } from "#/lib/heic";

/** Longest edge kept in the browser. Matches the API's cap. */
export const CLIENT_MAX_DIMENSION = 2560;

/** Ceiling for the compressed file. The API caps uploads at 50 MB. */
export const CLIENT_MAX_SIZE_MB = 4;

const COMPRESSION_OPTIONS = {
    maxSizeMB: CLIENT_MAX_SIZE_MB,
    maxWidthOrHeight: CLIENT_MAX_DIMENSION,
    useWebWorker: true,
    initialQuality: 0.85,
};

/**
 * GIF is excluded because compressing it through a canvas would flatten an
 * animation to a single frame.
 */
function isCompressibleImage(file: File): boolean {
    return file.type.startsWith("image/") && file.type !== "image/gif";
}

function inferMimeFromFilename(name: string): string | null {
    const ext = name.toLowerCase().split(".").pop();
    switch (ext) {
        case "jpg":
        case "jpeg":
            return "image/jpeg";
        case "png":
            return "image/png";
        case "webp":
            return "image/webp";
        case "gif":
            return "image/gif";
        case "pdf":
            return "application/pdf";
        default:
            return null;
    }
}

const EXTENSION_BY_MIME: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "application/pdf": "pdf",
};

/**
 * Wrap the compressed data in a real `File`.
 *
 * `imageCompression` hands back a `Blob` with a `name` property glued on — it
 * looks like a `File` in the preview and in FormData, but it fails
 * `instanceof File`. Schemas that require a `File` then reject the value, and
 * an upload posted straight from the Blob reaches the server named "blob".
 *
 * The original name is kept, with the extension corrected when the compressor
 * changed the format.
 */
function toFile(data: Blob, originalName: string, type: string): File {
    const extension = EXTENSION_BY_MIME[type];
    const currentExtension = originalName.toLowerCase().split(".").pop();
    const name =
        extension && currentExtension !== extension
            ? `${originalName.replace(/\.[^.]+$/, "")}.${extension}`
            : originalName;

    return new File([data], name, { type });
}

/**
 * Shrink an image file. Non-images, GIFs, and anything that fails to compress
 * are returned untouched — a failed optimization must never cost the user their
 * upload.
 */
export async function compressImageFile(file: File): Promise<File> {
    // HEIC først: komprimeringen går via en canvas, og hverken Chrome eller
    // Firefox kan dekode HEIC — så uten dette blir bildet stående urørt og
    // avvist av API-et, som bare tar imot JPEG, PNG, GIF og WebP. Feiler
    // konverteringen, kastes den videre: en fil ingen ledd i kjeden kan lese
    // er ikke noe å late som om gikk bra.
    const readable = await convertHeicToJpeg(file);

    if (!isCompressibleImage(readable)) return readable;

    try {
        const { default: imageCompression } =
            await import("browser-image-compression");
        const compressed = await imageCompression(
            readable,
            COMPRESSION_OPTIONS,
        );

        // Already-small images can come back larger than they went in.
        if (compressed.size >= readable.size) return readable;

        // Some browsers drop the MIME type on the resulting Blob, so fall back
        // to the type the file came in with.
        const type =
            compressed.type ||
            readable.type ||
            inferMimeFromFilename(readable.name) ||
            "application/octet-stream";
        return toFile(compressed, readable.name, type);
    } catch {
        return readable;
    }
}

/** {@link compressImageFile} over a list, compressing in parallel. */
export async function compressImageFiles(files: File[]): Promise<File[]> {
    return Promise.all(files.map(compressImageFile));
}
