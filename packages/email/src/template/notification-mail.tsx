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

interface NotificationMailProps {
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
}: NotificationMailProps) => {
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
                    <Text style={emailStyles.paragraph}>{description}</Text>
                    {link && (
                        <Button href={link} style={emailStyles.button}>
                            Se mer
                        </Button>
                    )}
                </Container>
                <Text style={emailStyles.footer}>Levert av INDEX</Text>
            </Body>
        </Html>
    );
};

export default NotificationMail;
