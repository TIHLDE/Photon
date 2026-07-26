import {
    applicationBudgetTypeLabels,
    applicationCaseTypeLabels,
    applicationStatusLabels,
    applicationTypeLabels,
    formatApplicationDate,
    formatNok,
} from "~/lib/application/labels";
import type { ApplicationWithDetails } from "~/lib/application/types";

/**
 * A one-line title for list views. Cases have a real name; the money types
 * get "<gruppe> – <beløp>", which is what a handler scans for.
 */
function buildTitle(application: ApplicationWithDetails): string {
    if (application.hsCase) return application.hsCase.caseName;
    if (application.expense) {
        return `${application.expense.group.name} – ${formatNok(application.expense.amountNok)}`;
    }
    if (application.support) {
        return `${application.support.group.name} – ${formatNok(application.support.totalAmountNok)}`;
    }
    return applicationTypeLabels[application.type];
}

function amountOf(application: ApplicationWithDetails): number | null {
    return (
        application.expense?.amountNok ??
        application.support?.totalAmountNok ??
        null
    );
}

function groupNameOf(application: ApplicationWithDetails): string | null {
    return (
        application.expense?.group.name ??
        application.support?.group.name ??
        null
    );
}

export function serializeApplicationSummary(
    application: ApplicationWithDetails,
) {
    return {
        id: application.id,
        type: application.type,
        typeLabel: applicationTypeLabels[application.type],
        status: application.status,
        statusLabel: applicationStatusLabels[application.status],
        title: buildTitle(application),
        contactName: application.contactName,
        contactEmail: application.contactEmail,
        submittedById: application.submittedById,
        submittedByName: application.submittedBy?.name ?? null,
        amountNok: amountOf(application),
        groupName: groupNameOf(application),
        hasPdf: application.pdfAssetKey !== null,
        handledByName: application.handledBy?.name ?? null,
        handledAt: application.handledAt?.toISOString() ?? null,
        createdAt: application.createdAt.toISOString(),
        updatedAt: application.updatedAt.toISOString(),
    };
}

/**
 * @param includeInternal whether the reader is a handler. The submitter must
 * never see the internal note.
 */
export function serializeApplicationDetail(
    application: ApplicationWithDetails,
    includeInternal: boolean,
) {
    return {
        ...serializeApplicationSummary(application),
        signature: application.signature,
        ...(includeInternal
            ? { internalComment: application.internalComment }
            : {}),
        attachments: application.attachments
            .slice()
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((attachment) => ({
                id: attachment.id,
                assetKey: attachment.assetKey,
                kind: attachment.kind,
                sortOrder: attachment.sortOrder,
            })),
        expense: application.expense
            ? {
                  ccEmail: application.expense.ccEmail,
                  amountNok: application.expense.amountNok,
                  expenseDate: application.expense.expenseDate,
                  budgetType: application.expense.budgetType,
                  budgetTypeLabel:
                      applicationBudgetTypeLabels[
                          application.expense.budgetType
                      ],
                  description: application.expense.description,
                  accountNumber: application.expense.accountNumber,
                  group: application.expense.group,
              }
            : null,
        support: application.support
            ? {
                  purpose: application.support.purpose,
                  eventDescription: application.support.eventDescription,
                  justification: application.support.justification,
                  totalAmountNok: application.support.totalAmountNok,
                  budgetLink: application.support.budgetLink,
                  summary: application.support.summary,
                  group: application.support.group,
              }
            : null,
        hsCase: application.hsCase
            ? {
                  caseName: application.hsCase.caseName,
                  caseType: application.hsCase.caseType,
                  caseTypeLabel:
                      applicationCaseTypeLabels[application.hsCase.caseType],
                  background: application.hsCase.background,
                  assessment: application.hsCase.assessment,
                  recommendation: application.hsCase.recommendation,
              }
            : null,
    };
}

/** The 3–4 at-a-glance lines used in the notification and receipt emails. */
export function buildEmailDetails(
    application: ApplicationWithDetails,
): { label: string; value: string }[] {
    if (application.expense) {
        return [
            { label: "Gruppe", value: application.expense.group.name },
            { label: "Beløp", value: formatNok(application.expense.amountNok) },
            {
                label: "Dato",
                value: formatApplicationDate(application.expense.expenseDate),
            },
        ];
    }

    if (application.support) {
        return [
            { label: "Gruppe", value: application.support.group.name },
            {
                label: "Søknadsbeløp",
                value: formatNok(application.support.totalAmountNok),
            },
            { label: "Formål", value: application.support.purpose },
        ];
    }

    if (application.hsCase) {
        return [
            { label: "Sak", value: application.hsCase.caseName },
            {
                label: "Type",
                value: applicationCaseTypeLabels[application.hsCase.caseType],
            },
        ];
    }

    return [];
}
