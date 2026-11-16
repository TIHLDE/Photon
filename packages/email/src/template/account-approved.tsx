import React from "react";
import { CtaButton, EmailLayout, Paragraph, Title } from "../components/layout";

export interface AccountApprovedEmailProps {
    /** The member's name, so the mail does not open with "Hei,". */
    name: string;
    /** Link to the login page. */
    loginUrl: string;
    logoUrl: string;
}

/**
 * Sent when an admin approves an account that signed itself up on the website.
 *
 * The person has been able to log in the whole time — what changed is what they
 * can do — so the mail leads with that rather than with "welcome".
 */
export const AccountApprovedEmail = ({
    name,
    loginUrl,
    logoUrl,
}: AccountApprovedEmailProps) => (
    <EmailLayout
        preview="Nå kan du melde deg på arrangementer på tihlde.org."
        logoUrl={logoUrl}
    >
        <Title>Brukeren din er godkjent</Title>
        <Paragraph>
            Hei {name}! En administrator har godkjent brukeren din på
            tihlde.org.
        </Paragraph>
        <Paragraph>
            Nå kan du melde deg på arrangementer og se sidene som er forbeholdt
            medlemmer.
        </Paragraph>
        <CtaButton href={loginUrl}>Logg inn</CtaButton>
    </EmailLayout>
);

AccountApprovedEmail.PreviewProps = {
    name: "Ola Nordmann",
    loginUrl: "https://tihlde.org/logg-inn",
    logoUrl: "https://tihlde.org/logo512.png",
} satisfies AccountApprovedEmailProps;

export default AccountApprovedEmail;
