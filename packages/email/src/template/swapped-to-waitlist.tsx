import React from "react";
import {
    CtaButton,
    EmailLayout,
    Highlight,
    Paragraph,
    Title,
} from "../components/layout";

export interface SwappedToWaitlistEmailProps {
    eventName: string;
    eventUrl: string;
    position: number;
    logoUrl: string;
}

export const SwappedToWaitlistEmail = ({
    eventName = "Eksempel arrangement",
    eventUrl = "https://tihlde.org/arrangementer/eksempel",
    position = 3,
    logoUrl,
}: SwappedToWaitlistEmailProps) => (
    <EmailLayout
        preview={`Du er flyttet til ventelisten for ${eventName}.`}
        logoUrl={logoUrl}
    >
        <Title>Endring i din påmelding til {eventName}</Title>
        <Paragraph>
            En bruker med prioritet har meldt seg på{" "}
            <strong>{eventName}</strong>, og du har derfor blitt flyttet til
            ventelisten.
        </Paragraph>
        <Highlight label="Din plass på ventelisten" value={position} />
        <Paragraph>
            Du vil få beskjed på e-post hvis det blir ledig plass.
        </Paragraph>
        <CtaButton href={eventUrl}>Se arrangement</CtaButton>
        <Paragraph muted>Vi beklager ulempen og håper du får plass!</Paragraph>
    </EmailLayout>
);

SwappedToWaitlistEmail.PreviewProps = {
    eventName: "Julebord",
    eventUrl: "https://tihlde.org/arrangementer/1",
    position: 3,
    logoUrl: "https://tihlde.org/logo512.png",
} satisfies SwappedToWaitlistEmailProps;

export default SwappedToWaitlistEmail;
