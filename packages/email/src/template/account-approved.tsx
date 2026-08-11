import {
    Body,
    Button,
    Container,
    Head,
    Heading,
    Html,
    Img,
    Text,
} from "@react-email/components";
import React from "react";
import { emailStyles } from "./styles";

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
                    Brukeren din er godkjent
                </Heading>
                <Text style={emailStyles.paragraph}>
                    Hei {name}! En administrator har godkjent brukeren din på
                    tihlde.org.
                </Text>
                <Text style={emailStyles.paragraph}>
                    Nå kan du melde deg på arrangementer og se sidene som er
                    forbeholdt medlemmer.
                </Text>
                <Button style={emailStyles.button} href={loginUrl}>
                    Logg inn
                </Button>
            </Container>
            <Text style={emailStyles.footer}>Levert av INDEX</Text>
        </Body>
    </Html>
);

export default AccountApprovedEmail;
