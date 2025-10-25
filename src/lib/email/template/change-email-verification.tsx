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
import { env } from "../../env";
import { emailStyles } from "./styles";

interface ChangeEmailVerificationProps {
    url: string;
}

export const ChangeEmailVerificationEmail = ({
    url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
}: ChangeEmailVerificationProps) => {
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
