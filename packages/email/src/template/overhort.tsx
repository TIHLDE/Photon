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

/**
 * Only what was typed into the form. The submission is anonymous, so nothing
 * about the sender may ever be added here.
 */
export interface OverhortEmailProps {
    name: string;
    statement: string;
    logoUrl: string;
}

export const OverhortEmail = ({
    name = "Ola Nordmann",
    statement = "Dette er et sitat.",
    logoUrl,
}: OverhortEmailProps) => {
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
                        Ny innsending til Overhört
                    </Heading>
                    <Text style={emailStyles.paragraph}>
                        Navnet til den skyldige: {name}
                    </Text>
                    <Text style={emailStyles.paragraph}>
                        Hva som ble sagt: {statement}
                    </Text>
                </Container>
                <Text style={emailStyles.footer}>Levert av INDEX</Text>
            </Body>
        </Html>
    );
};

export default OverhortEmail;
