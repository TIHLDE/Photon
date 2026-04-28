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
import { env } from "@photon/core/env";
import { emailStyles } from "./styles";

interface ContractSignedEmailProps {
    memberName: string;
    groupName: string;
    signedAt: string;
}

export const ContractSignedEmail = ({
    memberName = "Ola Nordmann",
    groupName = "Index",
    signedAt = new Date().toISOString(),
}: ContractSignedEmailProps) => {
    const formattedDate = new Date(signedAt).toLocaleDateString("nb-NO", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });

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
                        Frivillighetskontrakt signert
                    </Heading>
                    <Text style={emailStyles.paragraph}>
                        <strong>{memberName}</strong> har signert
                        frivillighetskontrakten for <strong>{groupName}</strong>
                        .
                    </Text>
                    <Text style={emailStyles.paragraph}>
                        Dato: {formattedDate}
                    </Text>
                    <Text style={emailStyles.paragraph}>
                        Du mottar denne e-posten fordi du er registrert som
                        varslingskontakt for {groupName}.
                    </Text>
                </Container>
                <Text style={emailStyles.footer}>Levert av INDEX</Text>
            </Body>
        </Html>
    );
};

export default ContractSignedEmail;
