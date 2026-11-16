import React from "react";
import { CtaButton, EmailLayout, Paragraph, Title } from "../components/layout";

export interface EventEvaluationEmailProps {
    eventName: string;
    formUrl: string;
    logoUrl: string;
}

export const EventEvaluationEmail = ({
    eventName = "Eksempel arrangement",
    formUrl = "https://tihlde.org/sporreskjema/eksempel",
    logoUrl,
}: EventEvaluationEmailProps) => (
    <EmailLayout preview={`Hva syntes du om ${eventName}?`} logoUrl={logoUrl}>
        <Title>Svar på evalueringen</Title>
        <Paragraph>
            Du var på <strong>{eventName}</strong>. Arrangørene bruker svarene
            til å gjøre neste arrangement bedre.
        </Paragraph>
        <CtaButton href={formUrl}>Svar på evalueringen</CtaButton>
        <Paragraph muted>
            Du må svare før du kan melde deg på flere arrangementer.
        </Paragraph>
    </EmailLayout>
);

EventEvaluationEmail.PreviewProps = {
    eventName: "Bedpres med Bedrift AS",
    formUrl: "https://tihlde.org/sporreskjema/eksempel",
    logoUrl: "https://tihlde.org/logo512.png",
} satisfies EventEvaluationEmailProps;

export default EventEvaluationEmail;
