import { renderToBuffer } from "@react-pdf/renderer";
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
 * @react-pdf to fetch — the bytes have to be inlined. Anything that isn't an
 * image (a PDF attachment, say) is skipped rather than crashing the render.
 */
async function loadAttachmentDataUris(
    bucket: StorageService,
    assetKeys: string[],
): Promise<string[]> {
    const dataUris: string[] = [];

    for (const key of assetKeys) {
        const asset = await bucket.getAsset(key);
        const contentType = asset?.contentType;
        if (!contentType?.startsWith("image/")) continue;

        const bytes = await bucket.download(key);
        dataUris.push(`data:${contentType};base64,${bytes.toString("base64")}`);
    }

    return dataUris;
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
    const images = await loadAttachmentDataUris(
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

            return renderToBuffer(
                <ExpensePdf
                    name={application.contactName}
                    email={application.contactEmail}
                    amount={formatNok(expense.amountNok)}
                    date={formatApplicationDate(expense.expenseDate)}
                    description={expense.description}
                    accountNumber={expense.accountNumber}
                    groupName={expense.group.name}
                    budgetType={applicationBudgetTypeLabels[expense.budgetType]}
                    signature={application.signature}
                    receipts={images}
                />,
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

            return renderToBuffer(
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
            );
        }

        case "hs_case": {
            const hsCase = application.hsCase;
            if (!hsCase) {
                throw new Error(
                    `HS case application ${application.id} has no detail row`,
                );
            }

            return renderToBuffer(
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
            );
        }
    }
}

export { ExpensePdf, HsCasePdf, SupportPdf };
