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
    phone?: string;
    companyType: string;
    hasTrondheimOffice?: boolean;
    about: string;
    themes?: string[];
    classLevels?: string[];
    participants?: string;
    extras?: string[];
    logoUrl: string;
}

export const CompanyContactEmail = ({
    company = "Bedrift AS",
    contactName = "Kari Nordmann",
    contactEmail = "kari@bedrift.no",
    eventTypes = ["Bedriftspresentasjon"],
    semesters = ["Høst 2026"],
    comment,
    phone,
    companyType = "Start-up",
    hasTrondheimOffice,
    about = "Vi lager programvare for norske kommuner.",
    themes = [],
    classLevels = [],
    participants,
    extras = [],
    logoUrl,
}: CompanyContactEmailProps) => {
    const details = [
        ["Bedriftstype", companyType],
        [
            "Kontorer i Trondheim",
            hasTrondheimOffice !== undefined &&
                (hasTrondheimOffice ? "Ja" : "Nei"),
        ],
        ["Om bedriften", about],
        ["Ønskede arrangementer", eventTypes.join(", ")],
        ["Aktuelle semestre", semesters.join(", ")],
        ["Klassetrinn", classLevels.join(", ")],
        ["Antall deltagere", participants],
        ["Temaer", themes.join(", ")],
        ["Samarbeid og annet", extras.join(", ")],
        ["Kommentar", comment],
    ] as const;

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
                        Kontaktperson: {contactName} ({contactEmail}
                        {phone && `, ${phone}`})
                    </Text>
                    {details.map(
                        ([label, value]) =>
                            value && (
                                <Text key={label} style={emailStyles.paragraph}>
                                    {label}: {value}
                                </Text>
                            ),
                    )}
                </Container>
                <Text style={emailStyles.footer}>Levert av INDEX</Text>
            </Body>
        </Html>
    );
};

export default CompanyContactEmail;
