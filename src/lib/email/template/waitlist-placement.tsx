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
import React from "react";
import { env } from "../../env";
import { emailStyles } from "./styles";

interface WaitlistPlacementEmailProps {
    eventName: string;
    eventUrl: string;
    position: number;
}

export const WaitlistPlacementEmail = ({
    eventName = "Eksempel arrangement",
    eventUrl = "https://tihlde.org/arrangementer/eksempel",
    position = 5,
}: WaitlistPlacementEmailProps) => {
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
                        Du er på venteliste for {eventName}
                    </Heading>
                    <Text style={emailStyles.paragraph}>
                        Din påmelding til <strong>{eventName}</strong> er
                        mottatt, men arrangementet er fullt.
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
                </Container>
                <Text style={emailStyles.footer}>Levert av INDEX</Text>
            </Body>
        </Html>
    );
};

export default WaitlistPlacementEmail;
