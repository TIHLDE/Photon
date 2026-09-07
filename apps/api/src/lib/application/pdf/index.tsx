import { renderToBuffer } from "@react-pdf/renderer";
import { PDFDocument } from "pdf-lib";
import React from "react";
import type { StorageService } from "~/lib/storage";
import {
    applicationBudgetTypeLabels,
    applicationCaseTypeLabels,
    applicationTypeLabels,
    formatApplicationDate,
    formatNok,
} from "../labels";
import type { ApplicationWithDetails } from "../types";
import { ExpensePdf } from "./expense";
import { HsCasePdf } from "./hs-case";
import { SupportPdf } from "./support";

/**
 * Attachments live in private object storage, so there is no URL for
 * @react-pdf to fetch — the bytes have to be inlined. @react-pdf only draws
 * images, so a PDF attachment is kept aside and appended by
 * {@link appendPdfAttachments} instead.
 */
async function loadAttachments(
    bucket: StorageService,
    assetKeys: string[],
): Promise<{ imageDataUris: string[]; pdfs: Buffer[] }> {
    const imageDataUris: string[] = [];
    const pdfs: Buffer[] = [];

    for (const key of assetKeys) {
        const asset = await bucket.getAsset(key);
        const contentType = asset?.contentType;

        if (contentType?.startsWith("image/")) {
            const bytes = await bucket.download(key);
            imageDataUris.push(
                `data:${contentType};base64,${bytes.toString("base64")}`,
            );
            continue;
        }

        if (contentType === "application/pdf") {
            pdfs.push(await bucket.download(key));
        }
    }

    return { imageDataUris, pdfs };
}

/**
 * Legger sidene fra PDF-vedleggene bakerst i den genererte søknaden.
 *
 * Uten dette ville en PDF-kvittering vært usynlig i akkurat det dokumentet
 * økonomiansvarlig leser. Et vedlegg som ikke lar seg lese hoppes over: en
 * søknad skal ikke gå tapt fordi ett bilag var ødelagt.
 */
async function appendPdfAttachments(
    document: Buffer,
    attachments: Buffer[],
): Promise<Buffer> {
    if (attachments.length === 0) return document;

    const merged = await PDFDocument.load(document);

    for (const attachment of attachments) {
        try {
            const source = await PDFDocument.load(attachment);
            const pages = await merged.copyPages(
                source,
                source.getPageIndices(),
            );
            for (const page of pages) merged.addPage(page);
        } catch (error) {
            console.error("Skipping unreadable PDF attachment", error);
        }
    }

    return Buffer.from(await merged.save());
}

/**
 * Render the PDF for a søknad.
 *
 * Ported from the standalone utlegg.tihlde.org portal, which wrote the PDF to
 * a file inside Next.js' public directory (briefly exposing it to the whole
 * internet) and read it back. Here it stays a Buffer the whole way.
 */
export async function renderApplicationPdf(
    application: ApplicationWithDetails,
    bucket: StorageService,
): Promise<Buffer> {
    const { imageDataUris: images, pdfs } = await loadAttachments(
        bucket,
        application.attachments.map((attachment) => attachment.assetKey),
    );

    switch (application.type) {
        case "expense": {
            const expense = application.expense;
            if (!expense) {
                throw new Error(
                    `Expense application ${application.id} has no detail row`,
                );
            }

            return appendPdfAttachments(
                await renderToBuffer(
                    <ExpensePdf
                        name={application.contactName}
                        email={application.contactEmail}
                        amount={formatNok(expense.amountNok)}
                        date={formatApplicationDate(expense.expenseDate)}
                        description={expense.description}
                        accountNumber={expense.accountNumber}
                        groupName={expense.group.name}
                        budgetType={
                            applicationBudgetTypeLabels[expense.budgetType]
                        }
                        signature={application.signature}
                        receipts={images}
                    />,
                ),
                pdfs,
            );
        }

        case "support":
        case "sports_support": {
            const support = application.support;
            if (!support) {
                throw new Error(
                    `Support application ${application.id} has no detail row`,
                );
            }

            return appendPdfAttachments(
                await renderToBuffer(
                    <SupportPdf
                        title={applicationTypeLabels[application.type]}
                        name={application.contactName}
                        email={application.contactEmail}
                        groupName={support.group.name}
                        purpose={support.purpose}
                        eventDescription={support.eventDescription}
                        justification={support.justification}
                        totalAmount={formatNok(support.totalAmountNok)}
                        budgetLink={support.budgetLink}
                        summary={support.summary}
                        signature={application.signature}
                        budgetImages={images}
                    />,
                ),
                pdfs,
            );
        }

        case "hs_case": {
            const hsCase = application.hsCase;
            if (!hsCase) {
                throw new Error(
                    `HS case application ${application.id} has no detail row`,
                );
            }

            return appendPdfAttachments(
                await renderToBuffer(
                    <HsCasePdf
                        contactName={application.contactName}
                        contactEmail={application.contactEmail}
                        caseName={hsCase.caseName}
                        caseType={applicationCaseTypeLabels[hsCase.caseType]}
                        background={hsCase.background}
                        assessment={hsCase.assessment}
                        recommendation={hsCase.recommendation}
                        images={images}
                    />,
                ),
                pdfs,
            );
        }

        // Bedriftshenvendelser are an inbox item, not a document that gets
        // signed or filed — there is nothing a PDF would add.
        case "company_contact":
            throw new Error(
                `Application ${application.id} is a company contact enquiry and has no PDF`,
            );
    }
}

export { ExpensePdf, HsCasePdf, SupportPdf };
