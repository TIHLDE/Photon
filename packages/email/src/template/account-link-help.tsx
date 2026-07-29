import {
    Body,
    Container,
    Head,
    Heading,
    Html,
    Img,
    Text,
} from "@react-email/components";
import React from "react";
import { emailStyles } from "./styles";

export interface AccountLinkHelpEmailProps {
    /** Name as Feide reports it — authenticated, unlike anything typed in. */
    feideName: string;
    /** NTNU username from the Feide login, when the claim carried one. */
    feideUsername?: string;
    /** Where to reach the member. */
    contactEmail: string;
    /** Anything they remember about the old account. */
    note?: string;
    logoUrl: string;
}

/**
 * Sent when a member cannot reach their old TIHLDE account on their own —
 * their Lepton username differs from their NTNU one, and they no longer have
 * the email address the old account was registered with. Nothing in the flow
 * can verify them at that point, so a human has to.
 */
export const AccountLinkHelpEmail = ({
    feideName = "Ola Nordmann",
    feideUsername,
    contactEmail = "ola@example.com",
    note,
    logoUrl,
}: AccountLinkHelpEmailProps) => {
    return (
        <Html>
            <Head />
            <Body style={emailStyles.main}>
                <Container style={emailStyles.container}>
                    <Img
                        src={logoUrl}
                        width="100"
                        height="100"
                        alt="TIHLDE Logomark"
                        style={emailStyles.logo}
                    />
                    <Heading style={emailStyles.heading}>
                        {feideName} får ikke koblet Feide til den gamle brukeren
                    </Heading>
                    <Text style={emailStyles.paragraph}>
                        Svar dem på: {contactEmail}
                    </Text>
                    {feideUsername && (
                        <Text style={emailStyles.paragraph}>
                            NTNU-brukernavn: {feideUsername}
                        </Text>
                    )}
                    {note && (
                        <Text style={emailStyles.paragraph}>
                            De husker: {note}
                        </Text>
                    )}
                    <Text style={emailStyles.paragraph}>
                        Finn den gamle brukeren i admin og sett brukernavnet til
                        NTNU-brukernavnet over. Da kobles kontoene neste gang de
                        logger inn med Feide.
                    </Text>
                </Container>
                <Text style={emailStyles.footer}>Levert av INDEX</Text>
            </Body>
        </Html>
    );
};

export default AccountLinkHelpEmail;
