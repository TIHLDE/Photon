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
// biome-ignore lint/correctness/noUnusedImports: <explanation>
import React from "react";
import { env } from "@photon/core/env";
import { emailStyles } from "./styles";

interface RegistrationConfirmedEmailProps {
    eventName: string;
    eventUrl: string;
}

export const RegistrationConfirmedEmail = ({
    eventName = "Eksempel arrangement",
    eventUrl = "https://tihlde.org/arrangementer/eksempel",
}: RegistrationConfirmedEmailProps) => {
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
                        Du er påmeldt {eventName}!
                    </Heading>
                    <Text style={emailStyles.paragraph}>
                        Gratulerer! Din påmelding til{" "}
                        <strong>{eventName}</strong> er bekreftet.
                    </Text>
                    <Text style={emailStyles.paragraph}>
                        Du har fått plass og kan glede deg til arrangementet.
                    </Text>
                    <Button href={eventUrl} style={emailStyles.button}>
                        Se arrangement
                    </Button>
                    <Text style={emailStyles.paragraph}>
                        Vi gleder oss til å se deg der!
                    </Text>
                </Container>
                <Text style={emailStyles.footer}>Levert av INDEX</Text>
            </Body>
        </Html>
    );
};

export default RegistrationConfirmedEmail;
