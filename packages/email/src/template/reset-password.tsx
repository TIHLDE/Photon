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

export interface ResetPasswordEmailProps {
    url: string;
    logoUrl: string;
}

export const ResetPasswordEmail = ({
    url,
    logoUrl,
}: ResetPasswordEmailProps) => {
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
                    <Heading style={emailStyles.secondary}>
                        Tilbakestill passordet ditt
                    </Heading>
                    <Text style={emailStyles.paragraph}>
                        Klikk på knappen under for å tilbakestille passordet
                        ditt.
                    </Text>
                    <Button href={url} style={emailStyles.button}>
                        Tilbakestill passord
                    </Button>
                    <Text style={emailStyles.paragraph}>
                        Hvis du ikke ba om å tilbakestille passordet, kan du
                        trygt ignorere denne e-posten.
                    </Text>
                </Container>
                <Text style={emailStyles.footer}>Levert av INDEX</Text>
            </Body>
        </Html>
    );
};

export default ResetPasswordEmail;
