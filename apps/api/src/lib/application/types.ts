import type { schema } from "@photon/db";

/** The group fields every søknad view needs alongside the slug. */
export type ApplicationGroupRef = {
    slug: string;
    name: string;
};

export type ApplicationExpenseDetail = schema.ApplicationExpense & {
    group: ApplicationGroupRef;
};

export type ApplicationSupportDetail = schema.ApplicationSupport & {
    group: ApplicationGroupRef;
};

/**
 * A søknad with everything needed to render it — the detail row for its type
 * plus attachments. Exactly one of `expense` / `support` / `hsCase` /
 * `companyContact` is set, decided by `type`; the others come back null from
 * the relational query.
 *
 * This is the shape returned by `findApplicationById` / `listApplications` in
 * ./service.ts, and consumed by the PDF renderer and the serializers.
 */
export type ApplicationWithDetails = schema.Application & {
    expense: ApplicationExpenseDetail | null;
    support: ApplicationSupportDetail | null;
    hsCase: schema.ApplicationHsCase | null;
    companyContact: schema.ApplicationCompanyContact | null;
    attachments: schema.ApplicationAttachment[];
    submittedBy: { id: string; name: string } | null;
    handledBy: { id: string; name: string } | null;
};
