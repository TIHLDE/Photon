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
                    Vi har mottatt søknaden din
                </Heading>
                <Text style={emailStyles.paragraph}>
                    {typeLabel} er sendt til {handlerLabel}.
                </Text>
                {details.map((detail) => (
                    <Text key={detail.label} style={emailStyles.paragraph}>
                        {detail.label}: <strong>{detail.value}</strong>
                    </Text>
                ))}
                <Button style={emailStyles.button} href={applicationsUrl}>
                    Se mine søknader
                </Button>
                <Text style={emailStyles.paragraph}>
                    Du får beskjed når søknaden er behandlet.
                </Text>
            </Container>
            <Text style={emailStyles.footer}>Levert av INDEX</Text>
        </Body>
    </Html>
);

export default ApplicationReceiptEmail;
