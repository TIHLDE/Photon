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
}: EventMessageEmailProps) => {
    const lines = body.split("\n");

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
                    <Heading style={emailStyles.heading}>{title}</Heading>
                    {/* white-space: pre-line er ikke støttet i alle e-postklienter. */}
                    <Text style={emailStyles.paragraph}>
                        {lines.map((line, index) => (
                            <React.Fragment key={index}>
                                {index > 0 && <br />}
                                {line}
                            </React.Fragment>
                        ))}
                    </Text>
                    <Button href={link} style={emailStyles.button}>
                        Se arrangementet
                    </Button>
                    <Text style={emailStyles.paragraph}>
                        Sendt av {senderName} om {eventTitle}
                    </Text>
                </Container>
                <Text style={emailStyles.footer}>Levert av INDEX</Text>
            </Body>
        </Html>
    );
};

export default EventMessageEmail;
