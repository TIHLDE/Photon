import React from "react";
import {
    Callout,
    CtaButton,
    EmailLayout,
    Paragraph,
    Title,
} from "../components/layout";

export interface ApplicationDecidedEmailProps {
    /** "Utlegg", "Søknad om støtte", … */
    typeLabel: string;
    /** "Godkjent" or "Avslått". */
    statusLabel: string;
    approved: boolean;
    /** Optional message from the handler, when they chose to share one. */
    message?: string;
    /** Link to "Mine søknader". */
    applicationsUrl: string;
    logoUrl: string;
}

/**
 * Sent when a søknad is approved or rejected. Deliberately not sent for
 * "under behandling" — that would be noise.
 */
export const ApplicationDecidedEmail = ({
    typeLabel,
    statusLabel,
    approved,
    message,
    applicationsUrl,
    logoUrl,
}: ApplicationDecidedEmailProps) => (
    <EmailLayout
        preview={
            approved
                ? "Søknaden din er godkjent."
                : "Søknaden din ble dessverre ikke innvilget."
        }
        logoUrl={logoUrl}
    >
        <Title>
            {typeLabel} er {statusLabel.toLowerCase()}
        </Title>
        <Paragraph>
            {approved
                ? "Søknaden din er godkjent."
                : "Søknaden din ble dessverre ikke innvilget."}
        </Paragraph>
        {message && <Callout label="Melding fra behandler">{message}</Callout>}
        <CtaButton href={applicationsUrl}>Se mine søknader</CtaButton>
    </EmailLayout>
);

ApplicationDecidedEmail.PreviewProps = {
    typeLabel: "Utlegg",
    statusLabel: "Godkjent",
    approved: true,
    message: "Pengene blir overført innen fem virkedager.",
    applicationsUrl: "https://tihlde.org/profil/soknader",
    logoUrl: "https://tihlde.org/logo512.png",
} satisfies ApplicationDecidedEmailProps;

export default ApplicationDecidedEmail;
