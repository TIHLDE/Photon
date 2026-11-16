import React from "react";
import { CtaButton, EmailLayout, Paragraph, Title } from "../components/layout";

export interface RegistrationConfirmedEmailProps {
    eventName: string;
    eventUrl: string;
    logoUrl: string;
}

export const RegistrationConfirmedEmail = ({
    eventName = "Eksempel arrangement",
    eventUrl = "https://tihlde.org/arrangementer/eksempel",
    logoUrl,
}: RegistrationConfirmedEmailProps) => (
    <EmailLayout
        preview={`Du har fått plass på ${eventName}.`}
        logoUrl={logoUrl}
    >
        <Title>Du er påmeldt {eventName}!</Title>
        <Paragraph>
            Gratulerer! Din påmelding til <strong>{eventName}</strong> er
            bekreftet. Du har fått plass og kan glede deg til arrangementet.
        </Paragraph>
        <CtaButton href={eventUrl}>Se arrangement</CtaButton>
        <Paragraph muted>Vi gleder oss til å se deg der!</Paragraph>
    </EmailLayout>
);

RegistrationConfirmedEmail.PreviewProps = {
    eventName: "Julebord",
    eventUrl: "https://tihlde.org/arrangementer/1",
    logoUrl: "https://tihlde.org/logo512.png",
} satisfies RegistrationConfirmedEmailProps;

export default RegistrationConfirmedEmail;
