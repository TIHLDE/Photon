import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { renderApplicationPdf } from "~/lib/application/pdf";
import type { ApplicationWithDetails } from "~/lib/application/types";
import type { StorageService } from "~/lib/storage";

/**
 * En kvittering kan komme som PDF, og @react-pdf tegner bare bilder. Uten at
 * sidene legges til bakerst ville bilaget vært usynlig i akkurat det
 * dokumentet økonomiansvarlig leser.
 */

async function makePdf(pageCount: number): Promise<Buffer> {
    const doc = await PDFDocument.create();
    for (let i = 0; i < pageCount; i++) {
        doc.addPage([200, 200]);
    }
    return Buffer.from(await doc.save());
}

function bucketWith(
    assets: Record<string, { contentType: string; bytes: Buffer }>,
): StorageService {
    return {
        getAsset: async (key: string) =>
            assets[key] ? { contentType: assets[key].contentType } : undefined,
        download: async (key: string) => assets[key]?.bytes,
    } as unknown as StorageService;
}

function expenseApplication(assetKeys: string[]): ApplicationWithDetails {
    return {
        id: "00000000-0000-0000-0000-000000000001",
        type: "expense",
        contactName: "Testern",
        contactEmail: "test@example.com",
        signature: "testern: Dataingeniør - 2023",
        attachments: assetKeys.map((assetKey, index) => ({
            id: `attachment-${index}`,
            assetKey,
            kind: "receipt",
            sortOrder: index,
        })),
        expense: {
            amountNok: 199.5,
            expenseDate: "2026-09-01",
            description: "Pizza til dugnad",
            accountNumber: "1234.56.78903",
            budgetType: "drift",
            group: { name: "Index" },
        },
    } as unknown as ApplicationWithDetails;
}

describe("renderApplicationPdf — PDF-vedlegg", () => {
    it("legger sidene fra et PDF-vedlegg bakerst i søknaden", async () => {
        const bucket = bucketWith({
            "receipts/kvittering.pdf": {
                contentType: "application/pdf",
                bytes: await makePdf(2),
            },
        });

        const withoutAttachment = await renderApplicationPdf(
            expenseApplication([]),
            bucket,
        );
        const withAttachment = await renderApplicationPdf(
            expenseApplication(["receipts/kvittering.pdf"]),
            bucket,
        );

        const base = await PDFDocument.load(withoutAttachment);
        const merged = await PDFDocument.load(withAttachment);

        expect(merged.getPageCount()).toBe(base.getPageCount() + 2);
    });

    it("hopper over et ødelagt PDF-vedlegg framfor å miste søknaden", async () => {
        const bucket = bucketWith({
            "receipts/ odelagt.pdf": {
                contentType: "application/pdf",
                bytes: Buffer.from("dette er ikke en pdf"),
            },
        });

        const pdf = await renderApplicationPdf(
            expenseApplication(["receipts/ odelagt.pdf"]),
            bucket,
        );

        await expect(PDFDocument.load(pdf)).resolves.toBeDefined();
    });
});
