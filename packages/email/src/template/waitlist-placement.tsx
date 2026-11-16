import React from "react";
import {
    CtaButton,
    EmailLayout,
    Highlight,
    Paragraph,
    Title,
} from "../components/layout";

export interface WaitlistPlacementEmailProps {
    eventName: string;
    eventUrl: string;
    position: number;
    logoUrl: string;
}

export const WaitlistPlacementEmail = ({
    eventName = "Eksempel arrangement",
    eventUrl = "https://tihlde.org/arrangementer/eksempel",
    position = 5,
    logoUrl,
}: WaitlistPlacementEmailProps) => (
    <EmailLayout
        preview={`Du er nummer ${position} på ventelisten for ${eventName}.`}
        logoUrl={logoUrl}
    >
        <Title>Du er på venteliste for {eventName}</Title>
        <Paragraph>
            Din påmelding til <strong>{eventName}</strong> er mottatt, men
            arrangementet er fullt.
        </Paragraph>
        <Highlight label="Din plass på ventelisten" value={position} />
        <Paragraph>
            Du vil få beskjed på e-post hvis det blir ledig plass.
        </Paragraph>
        <CtaButton href={eventUrl}>Se arrangement</CtaButton>
    </EmailLayout>
);

WaitlistPlacementEmail.PreviewProps = {
    eventName: "Julebord",
    eventUrl: "https://tihlde.org/arrangementer/1",
    position: 5,
    logoUrl: "https://tihlde.org/logo512.png",
} satisfies WaitlistPlacementEmailProps;

export default WaitlistPlacementEmail;
