import React from "react";
import {
    CtaButton,
    Divider,
    EmailLayout,
    Paragraph,
    Title,
} from "../components/layout";

export interface ResetPasswordEmailProps {
    url: string;
    logoUrl: string;
}

export const ResetPasswordEmail = ({
    url,
    logoUrl,
}: ResetPasswordEmailProps) => (
    <EmailLayout
        preview="Tilbakestill passordet ditt på TIHLDE."
        logoUrl={logoUrl}
    >
        <Title>Tilbakestill passordet ditt</Title>
        <Paragraph>
            Klikk på knappen under for å tilbakestille passordet ditt.
        </Paragraph>
        <CtaButton href={url}>Tilbakestill passord</CtaButton>
        <Divider />
        <Paragraph muted>
            Hvis du ikke ba om å tilbakestille passordet, kan du trygt ignorere
            denne e-posten.
        </Paragraph>
    </EmailLayout>
);

ResetPasswordEmail.PreviewProps = {
    url: "https://tihlde.org/tilbakestill?token=abc",
    logoUrl: "https://tihlde.org/logo512.png",
} satisfies ResetPasswordEmailProps;

export default ResetPasswordEmail;
