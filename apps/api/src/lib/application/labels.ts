import type {
    ApplicationBudgetType,
    ApplicationCaseType,
    ApplicationStatus,
    ApplicationType,
} from "@photon/db/schema";

/**
 * Norwegian labels for the søknad enums. The database stores English
 * identifiers; everything a human reads — PDFs, emails, the admin table —
 * goes through here so the wording only exists in one place.
 */

export const applicationTypeLabels: Record<ApplicationType, string> = {
    expense: "Utlegg",
    support: "Søknad om støtte",
    sports_support: "Søknad om støtte til idrettslag",
    hs_case: "Sak til HS",
};

export const applicationStatusLabels: Record<ApplicationStatus, string> = {
    new: "Ny",
    in_progress: "Under behandling",
    approved: "Godkjent",
    rejected: "Avslått",
};

export const applicationBudgetTypeLabels: Record<
    ApplicationBudgetType,
    string
> = {
    social_budget: "Sosialbudsjett",
    group_budget: "Gruppebudsjett",
    approved_hs_application: "Godkjent søknad til HS",
    approved_idkom_application: "Godkjent søknad fra IdKom",
};

export const applicationCaseTypeLabels: Record<ApplicationCaseType, string> = {
    discussion: "Diskusjonssak",
    decision: "Vedtakssak",
    orientation: "Orienteringssak",
};

/** "2026-07-25" → "25.07.2026". Returns the input unchanged if unparseable. */
export function formatApplicationDate(isoDate: string): string {
    const [year, month, day] = isoDate.split("-");
    if (!year || !month || !day) return isoDate;
    return `${day}.${month}.${year}`;
}

/** 1250 → "1 250 kr" (non-breaking space, as nb-NO formats it). */
export function formatNok(amount: number): string {
    return `${new Intl.NumberFormat("nb-NO").format(amount)} kr`;
}
