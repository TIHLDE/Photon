import type { AllowedMimeType } from "./index";

const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);
const PNG_SIGNATURE = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const GIF87_SIGNATURE = Buffer.from("GIF87a");
const GIF89_SIGNATURE = Buffer.from("GIF89a");
const RIFF_SIGNATURE = Buffer.from("RIFF");
const WEBP_SIGNATURE = Buffer.from("WEBP");
const PDF_SIGNATURE = Buffer.from("%PDF-");

/**
 * PDF readers accept the header anywhere in the first kilobyte, and scanners and
 * mail gateways do write files with bytes in front of it.
 */
const PDF_HEADER_SEARCH_BYTES = 1024;

/**
 * The allowed type a file really is, read from its first bytes, or `null` when
 * it is none of them. A declared MIME type is only the client's word for it.
 */
export function detectFileType(bytes: Buffer): AllowedMimeType | null {
    if (startsWith(bytes, JPEG_SIGNATURE)) return "image/jpeg";
    if (startsWith(bytes, PNG_SIGNATURE)) return "image/png";
    if (
        startsWith(bytes, GIF87_SIGNATURE) ||
        startsWith(bytes, GIF89_SIGNATURE)
    ) {
        return "image/gif";
    }
    if (
        startsWith(bytes, RIFF_SIGNATURE) &&
        startsWith(bytes.subarray(8), WEBP_SIGNATURE)
    ) {
        return "image/webp";
    }
    if (bytes.subarray(0, PDF_HEADER_SEARCH_BYTES).includes(PDF_SIGNATURE)) {
        return "application/pdf";
    }
    return null;
}

function startsWith(bytes: Buffer, signature: Buffer): boolean {
    return bytes.subarray(0, signature.length).equals(signature);
}
