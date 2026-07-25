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

export interface ApplicationSubmittedEmailProps {
    /** "Nytt utlegg til godkjenning", "Ny sak til HS", … */
    headline: string;
    /** "Utlegg", "Søknad om støtte", … */
    typeLabel: string;
    submitterName: string;
    /** A handful of at-a-glance lines — gruppe, beløp, dato. Keep it short. */
    details: { label: string; value: string }[];
    /** Deep link into the admin dashboard, opens the søknad directly. */
    dashboardUrl: string;
    logoUrl: string;
}

/**
 * Notification to whoever handles this type of søknad.
 *
 * Deliberately a summary, not a copy: the old portal attached the generated
 * PDF and every receipt to the email, which turned inboxes into the system of
 * record. Everything lives in the dashboard now, and the button goes there.
 */
export const ApplicationSubmittedEmail = ({
    headline,
    typeLabel,
    submitterName,
    details,
    dashboardUrl,
    logoUrl,
}: ApplicationSubmittedEmailProps) => (
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
                <Heading style={emailStyles.heading}>{headline}</Heading>
                <Text style={emailStyles.paragraph}>
                    <strong>{submitterName}</strong> har sendt inn{" "}
                    {typeLabel.toLowerCase()}.
                </Text>
                {details.map((detail) => (
                    <Text key={detail.label} style={emailStyles.paragraph}>
                        {detail.label}: <strong>{detail.value}</strong>
                    </Text>
                ))}
                <Button style={emailStyles.button} href={dashboardUrl}>
                    Se søknaden
                </Button>
                <Text style={emailStyles.paragraph}>
                    Alle detaljer og vedlegg ligger på nettsiden.
                </Text>
            </Container>
            <Text style={emailStyles.footer}>Levert av INDEX</Text>
        </Body>
    </Html>
);

export default ApplicationSubmittedEmail;
