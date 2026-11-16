import React from "react";
import { CtaButton, EmailLayout, Paragraph, Title } from "../components/layout";

export interface NotificationMailProps {
    title: string;
    description: string;
    link?: string;
    logoUrl: string;
}

export const NotificationMail = ({
    title = "Varsling fra TIHLDE",
    description = "Du har fått en ny varsling.",
    link,
    logoUrl,
}: NotificationMailProps) => (
    <EmailLayout preview={description} logoUrl={logoUrl}>
        <Title>{title}</Title>
        <Paragraph>{description}</Paragraph>
        {link && <CtaButton href={link}>Se mer</CtaButton>}
    </EmailLayout>
);

NotificationMail.PreviewProps = {
    title: "Du har fått en prikk",
    description:
        "Du har fått en prikk for å ikke møte opp på Bedpres med Bedrift AS. Prikken varer i 20 dager.",
    link: "https://tihlde.org/profil",
    logoUrl: "https://tihlde.org/logo512.png",
} satisfies NotificationMailProps;

export default NotificationMail;
