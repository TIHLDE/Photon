import {
    Body,
    Container,
    Head,
    Heading,
    Html,
    Img,
    Text,
} from "@react-email/components";
// biome-ignore lint/correctness/noUnusedImports: <explanation>
import React from "react";
import { env } from "@photon/core/env";
import { emailStyles } from "./styles";

interface RegistrationBlockedEmailProps {
    eventName: string;
    reason?: string;
}

export const RegistrationBlockedEmail = ({
    eventName = "Eksempel arrangement",
    reason = "Du har for mange prikker og kan ikke melde deg på arrangementet enda.",
}: RegistrationBlockedEmailProps) => {
    return (
        <Html>
            <Head />
            <Body style={emailStyles.main}>
                <Container style={emailStyles.container}>
                    <Img
                        src={`${env.ROOT_URL}/static/logomark.jpeg`}
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
