import React from "react";
import {
    CtaButton,
    DetailList,
    EmailLayout,
    Paragraph,
    Title,
} from "../components/layout";

export interface ApplicationReceiptEmailProps {
    /** "Utlegg", "Søknad om støtte", … */
    typeLabel: string;
    /** Who the søknad now sits with, e.g. "Finansminister". */
    handlerLabel: string;
    details: { label: string; value: string }[];
    /** Link to "Mine søknader". */
    applicationsUrl: string;
    logoUrl: string;
}

/** Confirmation to the person who submitted the søknad. */
export const ApplicationReceiptEmail = ({
    typeLabel,
    handlerLabel,
    details,
    applicationsUrl,
    logoUrl,
}: ApplicationReceiptEmailProps) => (
    <EmailLayout
        preview={`${typeLabel} er sendt til ${handlerLabel}.`}
        logoUrl={logoUrl}
    >
        <Title>Vi har mottatt søknaden din</Title>
        <Paragraph>
            {typeLabel} er sendt til {handlerLabel}. Du får beskjed når søknaden
            er behandlet.
        </Paragraph>
        {details.length > 0 && <DetailList rows={details} />}
        <CtaButton href={applicationsUrl}>Se mine søknader</CtaButton>
    </EmailLayout>
);

ApplicationReceiptEmail.PreviewProps = {
    typeLabel: "Utlegg",
    handlerLabel: "Finansminister",
    details: [
        { label: "Gruppe", value: "Index" },
        { label: "Beløp", value: "1 249,00 kr" },
        { label: "Dato", value: "12. november 2026" },
    ],
    applicationsUrl: "https://tihlde.org/profil/soknader",
    logoUrl: "https://tihlde.org/logo512.png",
} satisfies ApplicationReceiptEmailProps;

export default ApplicationReceiptEmail;
