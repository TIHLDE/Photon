import {
    Body,
    Container,
    Head,
    Heading,
    Html,
    Img,
    Section,
    Text,
} from "@react-email/components";
// biome-ignore lint/correctness/noUnusedImports: <explanation>
import React from "react";
import { env } from "@photon/core/env";
import { emailStyles } from "./styles";

interface OtpSignInProps {
    otp: string;
}

export const OtpSignInEmail = ({ otp = "123456" }: OtpSignInProps) => {
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
                    <Heading style={emailStyles.secondary}>
                        Skriv inn følgende kode
                        <br /> for å logge inn på TIHLDE
                    </Heading>
                    <Section style={emailStyles.codeContainer}>
                        <Text style={emailStyles.code}>{otp}</Text>
                    </Section>
                    <Text style={emailStyles.paragraph}>
                        Forventet du ikke denne e-posten?
                    </Text>
                    <Text style={emailStyles.paragraph}>
                        Du kan trygt ignorere denne e-posten hvis du ikke prøvde
                        å logge inn
                    </Text>
                </Container>
                <Text style={emailStyles.footer}>Levert av INDEX</Text>
            </Body>
        </Html>
    );
};

export default OtpSignInEmail;
