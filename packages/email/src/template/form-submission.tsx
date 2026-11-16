import React from "react";
import { CtaButton, EmailLayout, Paragraph, Title } from "../components/layout";

export interface FormSubmissionEmailProps {
    formTitle: string;
    submitterName: string;
    formUrl: string;
    logoUrl: string;
}

export const FormSubmissionEmail = ({
    formTitle,
    submitterName,
    formUrl,
    logoUrl,
}: FormSubmissionEmailProps) => (
    <EmailLayout
        preview={`${submitterName} har besvart «${formTitle}».`}
        logoUrl={logoUrl}
    >
        <Title>Nytt svar på spørreskjemaet</Title>
        <Paragraph>
            {submitterName} har besvart spørreskjemaet{" "}
            <strong>«{formTitle}»</strong>.
        </Paragraph>
        <CtaButton href={formUrl}>Se spørreskjema</CtaButton>
    </EmailLayout>
);

FormSubmissionEmail.PreviewProps = {
    formTitle: "Påmelding til hytteturen",
    submitterName: "Ola Nordmann",
    formUrl: "https://tihlde.org/sporreskjema/1",
    logoUrl: "https://tihlde.org/logo512.png",
} satisfies FormSubmissionEmailProps;

export default FormSubmissionEmail;
