import React from "react";
import { Callout, EmailLayout, Paragraph, Title } from "../components/layout";

export interface FormSubmissionDeletedEmailProps {
    formTitle: string;
    reason: string;
    logoUrl: string;
}

export const FormSubmissionDeletedEmail = ({
    formTitle,
    reason,
    logoUrl,
}: FormSubmissionDeletedEmailProps) => (
    <EmailLayout
        preview={`Ditt svar på «${formTitle}» har blitt slettet.`}
        logoUrl={logoUrl}
    >
        <Title>Ditt svar på spørreskjemaet har blitt slettet</Title>
        <Paragraph>
            Ditt svar på spørreskjemaet <strong>«{formTitle}»</strong> har blitt
            slettet av en administrator.
        </Paragraph>
        <Callout label="Grunnen er">{reason}</Callout>
    </EmailLayout>
);

FormSubmissionDeletedEmail.PreviewProps = {
    formTitle: "Påmelding til hytteturen",
    reason: "Svaret var registrert to ganger.",
    logoUrl: "https://tihlde.org/logo512.png",
} satisfies FormSubmissionDeletedEmailProps;

export default FormSubmissionDeletedEmail;
