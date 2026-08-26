import {
    Body,
    Container,
    Head,
    Heading,
    Html,
    Img,
    Text,
} from "@react-email/components";
import React from "react";
import { formatOsloDate } from "../date";
import { emailStyles } from "./styles";

export interface ContractSignedEmailProps {
    memberName: string;
    groupName: string;
    signedAt: string;
    logoUrl: string;
}

export const ContractSignedEmail = ({
    memberName,
    groupName,
    signedAt,
    logoUrl,
}: ContractSignedEmailProps) => {
    const formattedDate = formatOsloDate(signedAt);

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
