import { Link } from "@react-email/components";
import React from "react";
import {
    Callout,
    DetailList,
    EmailLayout,
    Paragraph,
    Title,
} from "../components/layout";
import { colors } from "../components/theme";

export interface AccountLinkHelpEmailProps {
    /** Name as Feide reports it — authenticated, unlike anything typed in. */
    feideName: string;
    /** NTNU username from the Feide login, when the claim carried one. */
    feideUsername?: string;
    /** Where to reach the member. */
    contactEmail: string;
    /** Anything they remember about the old account. */
    note?: string;
    logoUrl: string;
}

/**
 * Sent when a member cannot reach their old TIHLDE account on their own —
 * their Lepton username differs from their NTNU one, and they no longer have
 * the email address the old account was registered with. Nothing in the flow
 * can verify them at that point, so a human has to.
 */
export const AccountLinkHelpEmail = ({
    feideName = "Ola Nordmann",
    feideUsername,
    contactEmail = "ola@example.com",
    note,
    logoUrl,
}: AccountLinkHelpEmailProps) => {
    const rows = [
        { label: "Navn fra Feide", value: feideName },
        {
            label: "Svar dem på",
            value: (
                <Link
                    href={`mailto:${contactEmail}`}
                    style={{ color: colors.brand }}
                >
                    {contactEmail}
                </Link>
            ),
        },
        ...(feideUsername
            ? [{ label: "NTNU-brukernavn", value: feideUsername }]
            : []),
    ];

    return (
        <EmailLayout
            preview={`${feideName} trenger hjelp med å koble Feide til den gamle brukeren.`}
            logoUrl={logoUrl}
        >
            <Title>
                {feideName} får ikke koblet Feide til den gamle brukeren
            </Title>
            <DetailList rows={rows} />
            {note && <Callout label="De husker">{note}</Callout>}
            <Paragraph>
                Finn den gamle brukeren i admin og sett brukernavnet til
                NTNU-brukernavnet over. Da kobles kontoene neste gang de logger
                inn med Feide.
            </Paragraph>
        </EmailLayout>
    );
};

AccountLinkHelpEmail.PreviewProps = {
    feideName: "Ola Nordmann",
    feideUsername: "olanor",
    contactEmail: "ola@example.com",
    note: "Jeg registrerte meg med en gammel Gmail-adresse i 2021.",
    logoUrl: "https://tihlde.org/logo512.png",
} satisfies AccountLinkHelpEmailProps;

export default AccountLinkHelpEmail;
