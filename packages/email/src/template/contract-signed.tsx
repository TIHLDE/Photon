import React from "react";
import { formatOsloDate } from "../date";
import {
    DetailList,
    EmailLayout,
    Paragraph,
    Title,
} from "../components/layout";

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
}: ContractSignedEmailProps) => (
    <EmailLayout
        preview={`${memberName} har signert frivillighetskontrakten for ${groupName}.`}
        logoUrl={logoUrl}
        footerNote={`Du mottar denne e-posten fordi du er registrert som varslingskontakt for ${groupName}.`}
    >
        <Title>Frivillighetskontrakt signert</Title>
        <Paragraph>
            <strong>{memberName}</strong> har signert frivillighetskontrakten
            for <strong>{groupName}</strong>.
        </Paragraph>
        <DetailList
            rows={[
                { label: "Medlem", value: memberName },
                { label: "Gruppe", value: groupName },
                { label: "Dato", value: formatOsloDate(signedAt) },
            ]}
        />
    </EmailLayout>
);

ContractSignedEmail.PreviewProps = {
    memberName: "Ola Nordmann",
    groupName: "Index",
    signedAt: "2026-08-26T10:00:00.000Z",
    logoUrl: "https://tihlde.org/logo512.png",
} satisfies ContractSignedEmailProps;

export default ContractSignedEmail;
