import React from "react";
import { Callout, EmailLayout, Paragraph, Title } from "../components/layout";

export interface RegistrationBlockedEmailProps {
    eventName: string;
    reason?: string;
    logoUrl: string;
}

export const RegistrationBlockedEmail = ({
    eventName = "Eksempel arrangement",
    reason = "Du har for mange prikker og kan ikke melde deg på arrangementet enda.",
    logoUrl,
}: RegistrationBlockedEmailProps) => (
    <EmailLayout
        preview={`Påmeldingen din til ${eventName} ble ikke godkjent.`}
        logoUrl={logoUrl}
    >
        <Title>Påmelding ble ikke godkjent</Title>
        <Paragraph>
            Din påmelding til <strong>{eventName}</strong> ble dessverre ikke
            godkjent.
        </Paragraph>
        <Callout label="Årsak" tone="danger">
            {reason}
        </Callout>
        <Paragraph muted>
            Ta kontakt med arrangøren hvis du mener dette er en feil.
        </Paragraph>
    </EmailLayout>
);

RegistrationBlockedEmail.PreviewProps = {
    eventName: "Bedpres med Bedrift AS",
    reason: "Du har for mange prikker og kan ikke melde deg på arrangementet enda.",
    logoUrl: "https://tihlde.org/logo512.png",
} satisfies RegistrationBlockedEmailProps;

export default RegistrationBlockedEmail;
