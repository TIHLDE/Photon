import React from "react";
import {
    DetailList,
    EmailLayout,
    Paragraph,
    Title,
} from "../components/layout";

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
        <EmailLayout
            preview={`${company} har meldt interesse for et samarbeid`}
            logoUrl={logoUrl}
        >
            <Title>Ny henvendelse fra {company}</Title>
            <Paragraph>
                Svar på denne e-posten for å svare {contactName} direkte.
            </Paragraph>
            {sections.map(([title, rows]) => (
                <DetailList
                    key={title}
                    title={title}
                    rows={rows.map(([label, value]) => ({
                        label,
                        value: value || "–",
                    }))}
                />
            ))}
        </EmailLayout>
    );
};

CompanyContactEmail.PreviewProps = {
    company: "Bedrift AS",
    contactName: "Kari Nordmann",
    contactEmail: "kari@bedrift.no",
    phone: "+47 900 00 000",
    eventTypes: ["Bedriftspresentasjon", "Kurs/Workshop"],
    semesters: ["Høst 2026", "Vår 2027"],
    companyType: "Start-up",
    hasTrondheimOffice: true,
    about: "Vi lager programvare for norske kommuner.",
    themes: ["Webutvikling", "Sky"],
    classLevels: ["3. klasse", "4. klasse"],
    participants: "30–50",
    extras: ["Stillingsannonse"],
    comment: "Vi er fleksible på dato.",
    logoUrl: "https://tihlde.org/logo512.png",
} satisfies CompanyContactEmailProps;

export default CompanyContactEmail;
