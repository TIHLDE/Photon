import React from "react";
import {
    Divider,
    EmailLayout,
    Highlight,
    Paragraph,
    Title,
} from "../components/layout";

export interface OtpSignInProps {
    otp: string;
    logoUrl: string;
}

export const OtpSignInEmail = ({ otp = "123456", logoUrl }: OtpSignInProps) => (
    <EmailLayout preview={`Engangskoden din er ${otp}`} logoUrl={logoUrl}>
        <Title>Logg inn på TIHLDE</Title>
        <Paragraph>
            Skriv inn følgende kode for å logge inn på TIHLDE.
        </Paragraph>
        <Highlight label="Engangskode" value={otp} monospace />
        <Divider />
        <Paragraph muted>
            <strong>Forventet du ikke denne e-posten?</strong> Du kan trygt
            ignorere den hvis du ikke prøvde å logge inn.
        </Paragraph>
    </EmailLayout>
);

OtpSignInEmail.PreviewProps = {
    otp: "483920",
    logoUrl: "https://tihlde.org/logo512.png",
} satisfies OtpSignInProps;

export default OtpSignInEmail;
