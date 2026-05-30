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

interface ChangeEmailVerificationProps {
    url: string;
    logoUrl: string;
}

export const ChangeEmailVerificationEmail = ({
    url,
    logoUrl,
}: ChangeEmailVerificationProps) => {
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
                        Trykk på knappen nedenfor for å bekrefte din nye
                        e-postadresse
                    </Heading>
                    <Button href={url} style={emailStyles.button}>
                        Bekreft e-post
                    </Button>
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

export default ChangeEmailVerificationEmail;
