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

interface FormSubmissionEmailProps {
    formTitle: string;
    submitterName: string;
    groupSlug: string;
    logoUrl: string;
}

export const FormSubmissionEmail = ({
    formTitle,
    submitterName,
    groupSlug,
    logoUrl,
}: FormSubmissionEmailProps) => {
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
                        Nytt spørreskjema svar
                    </Heading>
                    <Text style={emailStyles.paragraph}>
                        {submitterName} har besvart spørreskjemaet "{formTitle}
                        ".
                    </Text>
                    <Button
                        href={`${env.ROOT_URL}/grupper/${groupSlug}/`}
                        style={emailStyles.button}
                    >
                        Se spørreskjema
                    </Button>
                </Container>
                <Text style={emailStyles.footer}>Levert av INDEX</Text>
            </Body>
        </Html>
    );
};

export default FormSubmissionEmail;
