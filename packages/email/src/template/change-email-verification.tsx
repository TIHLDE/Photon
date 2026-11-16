import React from "react";
import {
    CtaButton,
    Divider,
    EmailLayout,
    Paragraph,
    Title,
} from "../components/layout";

export interface ChangeEmailVerificationProps {
    url: string;
    logoUrl: string;
}

export const ChangeEmailVerificationEmail = ({
    url,
    logoUrl,
}: ChangeEmailVerificationProps) => (
    <EmailLayout
        preview="Bekreft din nye e-postadresse på TIHLDE."
        logoUrl={logoUrl}
    >
        <Title>Bekreft din nye e-postadresse</Title>
        <Paragraph>
            Trykk på knappen nedenfor for å bekrefte din nye e-postadresse.
        </Paragraph>
        <CtaButton href={url}>Bekreft e-post</CtaButton>
        <Divider />
        <Paragraph muted>
            <strong>Forventet du ikke denne e-posten?</strong> Du kan trygt
            ignorere den hvis du ikke prøvde å endre e-postadressen din.
        </Paragraph>
    </EmailLayout>
);

ChangeEmailVerificationEmail.PreviewProps = {
    url: "https://tihlde.org/bekreft-epost?token=abc",
    logoUrl: "https://tihlde.org/logo512.png",
} satisfies ChangeEmailVerificationProps;

export default ChangeEmailVerificationEmail;
