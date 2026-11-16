import React from "react";
import {
    CtaButton,
    EmailLayout,
    Highlight,
    Paragraph,
    Title,
} from "../components/layout";

export interface RegistrationOpeningEmailProps {
    eventName: string;
    eventUrl: string;
    /** Ferdig formatert åpningstidspunkt, f.eks. "12. august kl. 12:00". */
    registrationStart: string;
    logoUrl: string;
}

export const RegistrationOpeningEmail = ({
    eventName = "Eksempel arrangement",
    eventUrl = "https://tihlde.org/arrangementer/eksempel",
    registrationStart = "12. august kl. 12:00",
    logoUrl,
}: RegistrationOpeningEmailProps) => (
    <EmailLayout
        preview={`Påmeldingen til ${eventName} åpner ${registrationStart}.`}
        logoUrl={logoUrl}
        footerNote="Du får denne e-posten fordi du har arrangementet som favoritt."
    >
        <Title>Påmeldingen åpner snart</Title>
        <Paragraph>
            Gjør deg klar! Påmeldingen til <strong>{eventName}</strong> åpner
            snart.
        </Paragraph>
        <Highlight
            label="Påmeldingen åpner"
            value={registrationStart}
            size="sm"
        />
        <CtaButton href={eventUrl}>Se arrangement</CtaButton>
    </EmailLayout>
);

RegistrationOpeningEmail.PreviewProps = {
    eventName: "Julebord",
    eventUrl: "https://tihlde.org/arrangementer/1",
    registrationStart: "12. august kl. 12:00",
    logoUrl: "https://tihlde.org/logo512.png",
} satisfies RegistrationOpeningEmailProps;

export default RegistrationOpeningEmail;
