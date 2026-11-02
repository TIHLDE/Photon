import {
    Body,
    Container,
    Head,
    Heading,
    Hr,
    Html,
    Img,
    Preview,
    Section,
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

type Row = [label: string, value: string | undefined];

export const CompanyContactEmail = ({
    company = "Bedrift AS",
    contactName = "Kari Nordmann",
    contactEmail = "kari@bedrift.no",
    eventTypes = ["Bedriftspresentasjon", "Kurs/Workshop"],
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
    const office =
        hasTrondheimOffice === undefined
            ? undefined
            : hasTrondheimOffice
              ? "Ja"
              : "Nei";

    const sections: [title: string, rows: Row[]][] = [
        [
            "Kontakt",
            [
                ["Bedrift", company],
                ["Kontaktperson", contactName],
                ["E-post", contactEmail],
                ["Telefon", phone],
            ],
        ],
        [
            "Om bedriften",
            [
                ["Bedriftstype", companyType],
                ["Kontorer i Trondheim egnet for besøk", office],
                ["Relevante temaer", themes.join(", ")],
                ["Om bedriften", about],
            ],
        ],
        [
            "Ønsker",
            [
                ["Arrangementer", eventTypes.join(", ")],
                ["Semester", semesters.join(", ")],
                ["Klassetrinn", classLevels.join(", ")],
                ["Antall deltagere", participants],
                ["Samarbeid og annet", extras.join(", ")],
                ["Kommentar", comment],
            ],
        ],
    ];

    return (
        <Html>
            <Head />
            <Preview>{`${company} har meldt interesse for et samarbeid`}</Preview>
            <Body style={emailStyles.main}>
                <Container style={styles.container}>
                    <Img
                        src={logoUrl}
                        width="64"
                        height="64"
                        alt="TIHLDE Logomark"
                        style={emailStyles.logo}
                    />
                    <Heading style={emailStyles.heading}>
                        Ny henvendelse fra {company}
                    </Heading>
                    <Text style={emailStyles.paragraph}>
                        Svar på denne e-posten for å svare {contactName}{" "}
                        direkte.
                    </Text>
                    {sections.map(([title, rows]) => (
                        <Section key={title} style={styles.section}>
                            <Hr style={styles.hr} />
                            <Text style={styles.sectionTitle}>{title}</Text>
                            {rows.map(([label, value]) => (
                                <Section key={label} style={styles.row}>
                                    <Text style={styles.label}>{label}</Text>
                                    <Text style={styles.value}>
                                        {value || "–"}
                                    </Text>
                                </Section>
                            ))}
                        </Section>
                    ))}
                </Container>
                <Text style={emailStyles.footer}>Levert av INDEX</Text>
            </Body>
        </Html>
    );
};

const styles = {
    container: {
        ...emailStyles.container,
        maxWidth: "560px",
        padding: "48px 0 40px",
    },
    section: {
        padding: "0 40px",
    },
    hr: {
        borderColor: "#eee",
        margin: "28px 0 20px",
    },
    sectionTitle: {
        color: "#000",
        fontSize: "17px",
        fontWeight: 700,
        margin: "0 0 12px",
    },
    row: {
        marginBottom: "12px",
    },
    label: {
        color: "#5f5f5f",
        fontSize: "12px",
        fontWeight: 600,
        letterSpacing: "0.4px",
        lineHeight: "16px",
        margin: "0",
        textTransform: "uppercase" as const,
    },
    value: {
        color: "#222",
        fontSize: "15px",
        lineHeight: "22px",
        margin: "2px 0 0",
        whiteSpace: "pre-wrap" as const,
    },
};

export default CompanyContactEmail;
