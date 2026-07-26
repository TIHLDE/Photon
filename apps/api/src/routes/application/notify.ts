import { applicationTypeLabels } from "~/lib/application/labels";
import { recipientsFor } from "~/lib/application/recipients";
import type { ApplicationWithDetails } from "~/lib/application/types";
import type { AppContext } from "~/lib/ctx";
import { env } from "~/lib/env";
import type { LoggerType } from "~/middleware/logger";
import { buildEmailDetails } from "./serialize";

/** Who a submitter is told their søknad went to. */
const handlerLabels: Record<ApplicationWithDetails["type"], string> = {
    expense: "Finansminister",
    support: "Finansminister og Hovedstyret",
    sports_support: "IdKom",
    hs_case: "Hovedstyret",
};

const headlines: Record<ApplicationWithDetails["type"], string> = {
    expense: "Nytt utlegg til godkjenning",
    support: "Ny søknad om støtte",
    sports_support: "Ny søknad om støtte til idrettslag",
    hs_case: "Ny sak meldt inn til HS",
};

const logoUrl = () => `${env.WEBSITE_URL}/logo512.png`;
const adminUrl = (id: string) =>
    `${env.WEBSITE_URL}/admin/soknader?id=${encodeURIComponent(id)}`;
const myApplicationsUrl = () => `${env.WEBSITE_URL}/soknader?tab=mine`;

/**
 * Notify the handlers and confirm to the submitter.
 *
 * Both go through the queued email service, so neither blocks the request.
 * A failure here must not fail the submission — the søknad is already stored
 * and visible in the dashboard, which is the system of record now.
 */
export async function notifyApplicationSubmitted(
    ctx: AppContext,
    logger: LoggerType,
    application: ApplicationWithDetails,
): Promise<void> {
    const typeLabel = applicationTypeLabels[application.type];
    const details = buildEmailDetails(application);

    const to = recipientsFor(application.type);
    const cc = application.expense?.ccEmail ?? undefined;

    try {
        await ctx.email.sendEmailTemplate(
            {
                from: env.MAIL_FROM,
                to,
                cc,
                subject: headlines[application.type],
            },
            "ApplicationSubmittedEmail",
            {
                headline: headlines[application.type],
                typeLabel,
                submitterName: application.contactName,
                details,
                dashboardUrl: adminUrl(application.id),
                logoUrl: logoUrl(),
            },
        );
    } catch (error) {
        logger.error(
            { err: error, applicationId: application.id },
            "Failed to queue application notification email",
        );
    }

    try {
        await ctx.email.sendEmailTemplate(
            {
                from: env.MAIL_FROM,
                to: application.contactEmail,
                subject: `Kvittering: ${typeLabel}`,
            },
            "ApplicationReceiptEmail",
            {
                typeLabel,
                handlerLabel: handlerLabels[application.type],
                details,
                applicationsUrl: myApplicationsUrl(),
                logoUrl: logoUrl(),
            },
        );
    } catch (error) {
        logger.error(
            { err: error, applicationId: application.id },
            "Failed to queue application receipt email",
        );
    }
}

/**
 * Tell the submitter their søknad was approved or rejected.
 *
 * Only for final decisions — "under behandling" would be noise.
 */
export async function notifyApplicationDecided(
    ctx: AppContext,
    logger: LoggerType,
    application: ApplicationWithDetails,
    options: { approved: boolean; statusLabel: string; message?: string },
): Promise<void> {
    const typeLabel = applicationTypeLabels[application.type];

    try {
        await ctx.email.sendEmailTemplate(
            {
                from: env.MAIL_FROM,
                to: application.contactEmail,
                subject: `${typeLabel} er ${options.statusLabel.toLowerCase()}`,
            },
            "ApplicationDecidedEmail",
            {
                typeLabel,
                statusLabel: options.statusLabel,
                approved: options.approved,
                message: options.message,
                applicationsUrl: myApplicationsUrl(),
                logoUrl: logoUrl(),
            },
        );
    } catch (error) {
        logger.error(
            { err: error, applicationId: application.id },
            "Failed to queue application decision email",
        );
    }
}
