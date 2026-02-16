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
import { env } from "../../env";
import { emailStyles } from "./styles";

interface FormSubmissionDeletedEmailProps {
    formTitle: string;
    reason: string;
}

export const FormSubmissionDeletedEmail = ({
    formTitle,
    reason,
}: FormSubmissionDeletedEmailProps) => {
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
                        Ditt svar på spørreskjemaet har blitt slettet
                    </Heading>
                    <Text style={emailStyles.paragraph}>
                        Ditt svar på spørreskjemaet "{formTitle}" har blitt
                        slettet av en administrator.
                    </Text>
                    <Text style={emailStyles.paragraph}>
                        <strong>Grunnen er:</strong> {reason}
                    </Text>
                </Container>
                <Text style={emailStyles.footer}>Levert av INDEX</Text>
            </Body>
        </Html>
    );
};

export default FormSubmissionDeletedEmail;
