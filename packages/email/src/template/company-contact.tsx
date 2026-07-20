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
import { emailStyles } from "./styles";

export interface CompanyContactEmailProps {
    company: string;
    contactName: string;
    contactEmail: string;
    eventTypes: string[];
    semesters: string[];
    comment?: string;
    logoUrl: string;
}

export const CompanyContactEmail = ({
    company = "Bedrift AS",
    contactName = "Kari Nordmann",
    contactEmail = "kari@bedrift.no",
    eventTypes = ["Bedriftspresentasjon"],
    semesters = ["Høst 2026"],
    comment,
    logoUrl,
}: CompanyContactEmailProps) => {
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
                        Ny henvendelse fra {company}
                    </Heading>
                    <Text style={emailStyles.paragraph}>
                        Kontaktperson: {contactName} ({contactEmail})
                    </Text>
                    <Text style={emailStyles.paragraph}>
                        Ønskede arrangementer: {eventTypes.join(", ")}
                    </Text>
                    <Text style={emailStyles.paragraph}>
                        Aktuelle semestre: {semesters.join(", ")}
                    </Text>
                    {comment && (
                        <Text style={emailStyles.paragraph}>
                            Kommentar: {comment}
                        </Text>
                    )}
                </Container>
                <Text style={emailStyles.footer}>Levert av INDEX</Text>
            </Body>
        </Html>
    );
};

export default CompanyContactEmail;
