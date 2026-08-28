/**
 * Stamp a member's signature onto the volunteer contract PDF.
 *
 * Runs at signing time, not at download: the stamped PDF is stored as-is so the
 * signed document stays a fixed artifact. Regenerating it later from the same
 * inputs is possible (the raw signature PNG is retained), but the stored copy is
 * what the member actually agreed to.
 *
 * Placements arrive normalized (0..1 of each page's size) with a top-left origin,
 * matching how the browser places the field. pdf-lib uses a bottom-left origin,
 * so y is flipped here.
 */

import type { SignaturePlacement } from "@photon/db/schema";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatOsloDate, formatOsloDateTime } from "~/lib/oslo-day";

export type StampContractInput = {
    /** The original, unsigned contract PDF. */
    originalBytes: Uint8Array;
    /** Where to draw the signature image. Null skips the image. */
    signaturePlacement: SignaturePlacement | null;
    /** Where to draw the "navn, dato" line. Null skips the line. */
    namePlacement: SignaturePlacement | null;
    /** The signature as PNG bytes. */
    signaturePng: Uint8Array;
    signedName: string;
    signedAt: Date;
    signerIp?: string | null;
    signerUa?: string | null;
};

/** Long Norwegian date, e.g. "17. juli 2026". */
function formatDate(date: Date): string {
    return formatOsloDate(date, {
        day: "numeric",
        month: "long",
        year: "numeric",
    });
}

function formatDateTime(date: Date): string {
    return formatOsloDateTime(date, {
        dateStyle: "medium",
        timeStyle: "short",
    });
}

/**
 * Crop the transparent margin off a signature PNG.
 *
 * Both signature inputs hand us a fixed-size canvas with the strokes somewhere
 * in the middle, so most of the image is empty. Stamped as-is the ink lands in
 * the middle of the placement box and reads as floating above the line the
 * admin aimed at, no matter how precisely the box was placed. Trimming makes
 * the PNG's edges the ink's edges, so the placement box means what it looks
 * like it means.
 *
 * Falls back to the original bytes if the image cannot be trimmed — a
 * misaligned signature beats a failed signing.
 *
 * `sharp` is imported here rather than at the top of the file on purpose. It
 * loads a native binary, and a top-level import makes that load part of booting
 * the API: this module hangs off the contract routes, so a `sharp` that cannot
 * load takes down every endpoint, not just signing. That is exactly what
 * happened on 14 August 2026 — the whole API crash-looped on boot for 18
 * minutes because the release image could not resolve sharp's platform package.
 * Imported here, the same failure lands in the catch below and costs us a
 * slightly misaligned signature.
 */
async function trimSignature(png: Uint8Array): Promise<Uint8Array> {
    try {
        const { default: sharp } = await import("sharp");
        const trimmed = await sharp(Buffer.from(png))
            .trim({
                background: { r: 0, g: 0, b: 0, alpha: 0 },
                threshold: 10,
            })
            .png()
            .toBuffer();
        return new Uint8Array(trimmed);
    } catch {
        return png;
    }
}

export async function stampContractPdf(
    input: StampContractInput,
): Promise<Buffer> {
    const pdf = await PDFDocument.load(input.originalBytes);
    const pages = pdf.getPages();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

    // --- Signature image ---
    if (input.signaturePlacement) {
        const placement = input.signaturePlacement;
        const page = pages[placement.page];
        if (page) {
            const image = await pdf.embedPng(
                await trimSignature(input.signaturePng),
            );
            const { width: W, height: H } = page.getSize();
            const boxW = placement.wPct * W;
            const boxH = placement.hPct * H;
            // top-left origin (browser) → bottom-left origin (pdf-lib)
            const boxBottom = H - placement.yPct * H - boxH;

            // Fit inside the box without distorting the handwriting, then rest
            // the ink on the box's bottom edge and centre it horizontally —
            // that edge is the signature line, the way a pen would sit on it.
            const scale = Math.min(boxW / image.width, boxH / image.height);
            const w = image.width * scale;
            const h = image.height * scale;

            page.drawImage(image, {
                x: placement.xPct * W + (boxW - w) / 2,
                y: boxBottom,
                width: w,
                height: h,
            });
        }
    }

    // --- "navn, dato" line ---
    if (input.namePlacement) {
        const placement = input.namePlacement;
        const page = pages[placement.page];
        if (page) {
            const { width: W, height: H } = page.getSize();
            const boxH = placement.hPct * H;
            // Keep it close to a printed form label, never larger.
            const size = Math.min(10, Math.max(8, boxH * 0.55));
            const text = `${input.signedName}, ${formatDate(input.signedAt)}`;
            page.drawText(text, {
                x: placement.xPct * W + 2,
                y: H - placement.yPct * H - boxH / 2 - size / 2 + size * 0.15,
                size,
                font,
                color: rgb(0, 0, 0),
            });
        }
    }

    // --- Audit trail page ---
    // Appended unconditionally: even if a placement is missing or a page index is
    // stale, the signed PDF still carries who signed it and when.
    const auditPage = pdf.addPage();
    const { width, height } = auditPage.getSize();
    const margin = 56;
    let y = height - margin;

    auditPage.drawText("Signatur-revisjonsspor", {
        x: margin,
        y,
        size: 16,
        font: fontBold,
        color: rgb(0, 0, 0),
    });
    y -= 28;

    const rows: Array<[string, string]> = [
        ["Navn", input.signedName],
        ["Signert", formatDateTime(input.signedAt)],
        ["IP-adresse", input.signerIp ?? "—"],
        ["Nettleser", input.signerUa ?? "—"],
    ];

    for (const [label, value] of rows) {
        auditPage.drawText(`${label}:`, {
            x: margin,
            y,
            size: 10,
            font: fontBold,
            color: rgb(0.25, 0.25, 0.25),
        });
        // User agents run long; wrap rather than bleed off the page.
        const lines = wrapText(value, font, 9, width - margin * 2 - 100);
        for (const line of lines) {
            auditPage.drawText(line, {
                x: margin + 100,
                y,
                size: 9,
                font,
                color: rgb(0, 0, 0),
            });
            y -= 14;
        }
        y -= 6;
    }

    return Buffer.from(await pdf.save());
}

/** Greedy word wrap against the embedded font's real glyph widths. */
function wrapText(
    text: string,
    font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
    size: number,
    maxWidth: number,
): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length === 0) return ["—"];

    const lines: string[] = [];
    let line = "";

    for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
            line = candidate;
        } else {
            if (line) lines.push(line);
            line = word;
        }
    }
    if (line) lines.push(line);

    return lines;
}
