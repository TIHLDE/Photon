import React from "react";
import {
    CtaButton,
    DetailList,
    EmailLayout,
    Paragraph,
    Title,
} from "../components/layout";

export interface ApplicationSubmittedEmailProps {
    /** "Nytt utlegg til godkjenning", "Ny sak til HS", … */
    headline: string;
    /** "Utlegg", "Søknad om støtte", … */
    typeLabel: string;
    submitterName: string;
    /** A handful of at-a-glance lines — gruppe, beløp, dato. Keep it short. */
    details: { label: string; value: string }[];
    /** Deep link into the admin dashboard, opens the søknad directly. */
    dashboardUrl: string;
    logoUrl: string;
}

/**
 * Notification to whoever handles this type of søknad.
 *
 * Deliberately a summary, not a copy: the old portal attached the generated
 * PDF and every receipt to the email, which turned inboxes into the system of
 * record. Everything lives in the dashboard now, and the button goes there.
 */
export const ApplicationSubmittedEmail = ({
    headline,
    typeLabel,
    submitterName,
    details,
    dashboardUrl,
    logoUrl,
}: ApplicationSubmittedEmailProps) => (
    <EmailLayout
        preview={`${submitterName} har sendt inn ${typeLabel.toLowerCase()}.`}
        logoUrl={logoUrl}
    >
        <Title>{headline}</Title>
        <Paragraph>
            <strong>{submitterName}</strong> har sendt inn{" "}
            {typeLabel.toLowerCase()}.
        </Paragraph>
        {details.length > 0 && <DetailList rows={details} />}
        <CtaButton href={dashboardUrl}>Se søknaden</CtaButton>
        <Paragraph muted>
            Alle detaljer og vedlegg ligger på nettsiden.
        </Paragraph>
    </EmailLayout>
);

ApplicationSubmittedEmail.PreviewProps = {
    headline: "Nytt utlegg til godkjenning",
    typeLabel: "Utlegg",
    submitterName: "Ola Nordmann",
    details: [
        { label: "Gruppe", value: "Index" },
        { label: "Beløp", value: "1 249,00 kr" },
        { label: "Dato", value: "12. november 2026" },
    ],
    dashboardUrl: "https://tihlde.org/admin/soknader/1",
    logoUrl: "https://tihlde.org/logo512.png",
} satisfies ApplicationSubmittedEmailProps;

export default ApplicationSubmittedEmail;
