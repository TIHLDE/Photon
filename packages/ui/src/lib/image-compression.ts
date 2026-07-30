/**
 * Client-side image compression, applied before a file is ever uploaded.
 *
 * The API re-encodes every image as well, and that server pass is what
 * *guarantees* optimized assets. This one exists for the upload itself: a 12 MB
 * phone photo on conference wifi is a slow, failure-prone request, and shrinking
 * it in a worker first turns that into well under a megabyte.
 */

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

/**
 * Shrink an image file. Non-images, GIFs, and anything that fails to compress
 * are returned untouched — a failed optimization must never cost the user their
 * upload.
 */
export async function compressImageFile(file: File): Promise<File> {
    if (!isCompressibleImage(file)) return file;

    try {
        const { default: imageCompression } =
            await import("browser-image-compression");
        const compressed = await imageCompression(file, COMPRESSION_OPTIONS);

        // Already-small images can come back larger than they went in.
        if (compressed.size >= file.size) return file;

        if (compressed.type) return compressed as File;

        // Some browsers drop the MIME type on the resulting Blob. Re-wrap it so
        // the server still receives a recognizable Content-Type.
        const fallbackType =
            file.type ||
            inferMimeFromFilename(file.name) ||
            "application/octet-stream";
        return new File([compressed], file.name, { type: fallbackType });
    } catch {
        return file;
    }
}

/** {@link compressImageFile} over a list, compressing in parallel. */
export async function compressImageFiles(files: File[]): Promise<File[]> {
    return Promise.all(files.map(compressImageFile));
}
