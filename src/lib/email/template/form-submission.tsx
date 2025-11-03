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

interface FormSubmissionEmailProps {
    formTitle: string;
    submitterName: string;
    groupSlug: string;
}

export const FormSubmissionEmail = ({
    formTitle,
    submitterName,
    groupSlug,
}: FormSubmissionEmailProps) => {
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
