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

interface RegistrationBlockedEmailProps {
    eventName: string;
    reason?: string;
    logoUrl: string;
}

export const RegistrationBlockedEmail = ({
    eventName = "Eksempel arrangement",
    reason = "Du har for mange prikker og kan ikke melde deg på arrangementet enda.",
    logoUrl,
}: RegistrationBlockedEmailProps) => {
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
                        Påmelding ble ikke godkjent
                    </Heading>
                    <Text style={emailStyles.paragraph}>
                        Din påmelding til <strong>{eventName}</strong> ble
                        dessverre ikke godkjent.
                    </Text>
                    <Text style={emailStyles.paragraph}>
                        <strong>Årsak:</strong> {reason}
                    </Text>
                    <Text style={emailStyles.paragraph}>
                        Ta kontakt med arrangementet hvis du mener dette er en
                        feil.
                    </Text>
                </Container>
                <Text style={emailStyles.footer}>Levert av INDEX</Text>
            </Body>
        </Html>
    );
};

export default RegistrationBlockedEmail;
