import {
    Body,
    Button,
    Container,
    Head,
    Heading,
    Html,
    Img,
    Text,
} from "@react-email/components";
import React from "react";
import { emailStyles } from "./styles";

export interface EventEvaluationEmailProps {
    eventName: string;
    formUrl: string;
    logoUrl: string;
}

export const EventEvaluationEmail = ({
    eventName = "Eksempel arrangement",
    formUrl = "https://tihlde.org/sporreskjema/eksempel",
    logoUrl,
}: EventEvaluationEmailProps) => {
    return (
        <Html>
            <Head />
            <Body style={emailStyles.main}>
                <Container style={emailStyles.container}>
                    <Img
                        src={logoUrl}
                        width="100"
                        height="100"
                        alt="TIHLDE Logomark"
                        style={emailStyles.logo}
                    />
                    <Heading style={emailStyles.heading}>
                        Svar på evalueringen
                    </Heading>
                    <Text style={emailStyles.paragraph}>
                        Du var på <strong>{eventName}</strong>. Arrangørene
                        bruker svarene til å gjøre neste arrangement bedre.
                    </Text>
                    <Button href={formUrl} style={emailStyles.button}>
                        Svar på evalueringen
                    </Button>
                    <Text style={emailStyles.paragraph}>
                        Du må svare før du kan melde deg på flere arrangementer.
                    </Text>
                </Container>
                <Text style={emailStyles.footer}>Levert av INDEX</Text>
            </Body>
        </Html>
    );
};

export default EventEvaluationEmail;
