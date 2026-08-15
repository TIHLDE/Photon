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
}: RegistrationOpeningEmailProps) => {
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
                        Påmeldingen åpner snart
                    </Heading>
                    <Text style={emailStyles.paragraph}>
                        Påmeldingen til <strong>{eventName}</strong> åpner{" "}
                        {registrationStart}.
                    </Text>
                    <Button href={eventUrl} style={emailStyles.button}>
                        Se arrangement
                    </Button>
                    <Text style={emailStyles.paragraph}>
                        Du får denne e-posten fordi du har arrangementet som
                        favoritt.
                    </Text>
                </Container>
                <Text style={emailStyles.footer}>Levert av INDEX</Text>
            </Body>
        </Html>
    );
};

export default RegistrationOpeningEmail;
