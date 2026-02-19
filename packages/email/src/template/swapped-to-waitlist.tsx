import {
    Body,
    Button,
    Container,
    Head,
    Heading,
    Html,
    Img,
    Section,
    Text,
} from "@react-email/components";
// biome-ignore lint/correctness/noUnusedImports: <explanation>
import React from "react";
import { env } from "@photon/core/env";
import { emailStyles } from "./styles";

interface SwappedToWaitlistEmailProps {
    eventName: string;
    eventUrl: string;
    position: number;
}

export const SwappedToWaitlistEmail = ({
    eventName = "Eksempel arrangement",
    eventUrl = "https://tihlde.org/arrangementer/eksempel",
    position = 3,
}: SwappedToWaitlistEmailProps) => {
    return (
        <Html>
            <Head />
            <Body style={emailStyles.main}>
                <Container style={emailStyles.container}>
                    <Img
                        src={`${env.ROOT_URL}/static/logomark.jpeg`}
                        width="100"
                        height="100"
                        alt="TIHLDE Logomark"
                        style={emailStyles.logo}
                    />
                    <Heading style={emailStyles.heading}>
                        Endring i din påmelding til {eventName}
                    </Heading>
                    <Text style={emailStyles.paragraph}>
                        En bruker med prioritet har meldt seg på{" "}
                        <strong>{eventName}</strong>, og du har derfor blitt
                        flyttet til ventelisten.
                    </Text>
                    <Section style={emailStyles.positionContainer}>
                        <Text style={emailStyles.positionLabel}>
                            Din plass på ventelisten:
                        </Text>
                        <Text style={emailStyles.positionNumber}>
                            {position}
                        </Text>
                    </Section>
                    <Text style={emailStyles.paragraph}>
                        Du vil få beskjed på e-post hvis det blir ledig plass.
                    </Text>
                    <Button href={eventUrl} style={emailStyles.button}>
                        Se arrangement
                    </Button>
                    <Text style={emailStyles.paragraph}>
                        Vi beklager ulempen og håper du får plass!
                    </Text>
                </Container>
                <Text style={emailStyles.footer}>Levert av INDEX</Text>
            </Body>
        </Html>
    );
};

export default SwappedToWaitlistEmail;
