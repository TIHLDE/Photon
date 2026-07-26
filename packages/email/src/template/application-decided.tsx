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

export interface ApplicationDecidedEmailProps {
    /** "Utlegg", "Søknad om støtte", … */
    typeLabel: string;
    /** "Godkjent" or "Avslått". */
    statusLabel: string;
    approved: boolean;
    /** Optional message from the handler, when they chose to share one. */
    message?: string;
    /** Link to "Mine søknader". */
    applicationsUrl: string;
    logoUrl: string;
}

/**
 * Sent when a søknad is approved or rejected. Deliberately not sent for
 * "under behandling" — that would be noise.
 */
export const ApplicationDecidedEmail = ({
    typeLabel,
    statusLabel,
    approved,
    message,
    applicationsUrl,
    logoUrl,
}: ApplicationDecidedEmailProps) => (
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
                    {typeLabel} er {statusLabel.toLowerCase()}
                </Heading>
                <Text style={emailStyles.paragraph}>
                    {approved
                        ? "Søknaden din er godkjent."
                        : "Søknaden din ble dessverre ikke innvilget."}
                </Text>
                {message && (
                    <Text style={emailStyles.paragraph}>
                        Melding fra behandler: <strong>{message}</strong>
                    </Text>
                )}
                <Button style={emailStyles.button} href={applicationsUrl}>
                    Se mine søknader
                </Button>
            </Container>
            <Text style={emailStyles.footer}>Levert av INDEX</Text>
        </Body>
    </Html>
);

export default ApplicationDecidedEmail;
