import React from "react";
import {
    CtaButton,
    EmailLayout,
    MultilineText,
    Paragraph,
    Title,
} from "../components/layout";

export interface EventMessageEmailProps {
    title: string;
    body: string;
    eventTitle: string;
    senderName: string;
    link: string;
    logoUrl: string;
}

export const EventMessageEmail = ({
    title = "Bussen går 17:00",
    body = "Vi samles utenfor hovedinngangen.\nHusk varme klær!",
    eventTitle = "Julebord",
    senderName = "Index",
    link = "https://tihlde.org",
    logoUrl = "https://tihlde.org/logo512.png",
}: EventMessageEmailProps) => (
    <EmailLayout preview={body.split("\n")[0] ?? title} logoUrl={logoUrl}>
        <Title>{title}</Title>
        <Paragraph>
            <MultilineText text={body} />
        </Paragraph>
        <CtaButton href={link}>Se arrangementet</CtaButton>
        <Paragraph muted>
            Sendt av {senderName} om {eventTitle}
        </Paragraph>
    </EmailLayout>
);

EventMessageEmail.PreviewProps = {
    title: "Bussen går 17:00",
    body: "Vi samles utenfor hovedinngangen.\nHusk varme klær!",
    eventTitle: "Julebord",
    senderName: "Index",
    link: "https://tihlde.org/arrangementer/1",
    logoUrl: "https://tihlde.org/logo512.png",
} satisfies EventMessageEmailProps;

export default EventMessageEmail;
