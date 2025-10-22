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
            <Body style={main}>
                <Container style={container}>
                    <Img
                        src={`${env.ROOT_URL}/static/logomark.jpeg`}
                        width="100"
                        height="100"
                        alt="TIHLDE Logomark"
                        style={logo}
                    />
                    <Heading style={secondary}>
                        Du er på venteliste for {eventName}
                    </Heading>
                    <Text style={paragraph}>
                        Din påmelding til <strong>{eventName}</strong> er
                        mottatt, men arrangementet er fullt.
                    </Text>
                    <Section style={positionContainer}>
                        <Text style={positionLabel}>
                            Din plass på ventelisten:
                        </Text>
                        <Text style={positionNumber}>{position}</Text>
                    </Section>
                    <Text style={paragraph}>
                        Du vil få beskjed på e-post hvis det blir ledig plass.
                    </Text>
                    <Button href={eventUrl} style={button}>
                        Se arrangement
                    </Button>
                </Container>
                <Text style={footer}>Levert av INDEX</Text>
            </Body>
        </Html>
    );
};

export default WaitlistPlacementEmail;

const main = {
    backgroundColor: "#ffffff",
    fontFamily: "HelveticaNeue,Helvetica,Arial,sans-serif",
};

const container = {
    backgroundColor: "#ffffff",
    border: "1px solid #eee",
    borderRadius: "5px",
    boxShadow: "0 5px 10px rgba(20,50,70,.2)",
    marginTop: "20px",
    maxWidth: "360px",
    margin: "0 auto",
    padding: "68px 0 130px",
};

const logo = {
    margin: "0 auto",
    marginBottom: "24px",
};

const secondary = {
    color: "#000",
    display: "inline-block",
    fontFamily: "HelveticaNeue-Medium,Helvetica,Arial,sans-serif",
    fontSize: "20px",
    fontWeight: 500,
    lineHeight: "24px",
    marginBottom: "0",
    marginTop: "0",
    padding: "0 20px",
    width: "calc(100% - 40px)",
    textAlign: "center" as const,
};

const positionContainer = {
    background: "rgba(0,0,0,.05)",
    borderRadius: "4px",
    margin: "16px auto 14px",
    verticalAlign: "middle",
    width: "280px",
    padding: "16px 0",
};

const positionLabel = {
    color: "#666",
    fontFamily: "HelveticaNeue,Helvetica,Arial,sans-serif",
    fontSize: "14px",
    fontWeight: 400,
    margin: "0",
    textAlign: "center" as const,
    display: "block",
};

const positionNumber = {
    color: "#000",
    fontFamily: "HelveticaNeue-Bold",
    fontSize: "48px",
    fontWeight: 700,
    lineHeight: "56px",
    margin: "8px 0 0 0",
    display: "block",
    textAlign: "center" as const,
};

const paragraph = {
    color: "#444",
    fontSize: "15px",
    fontFamily: "HelveticaNeue,Helvetica,Arial,sans-serif",
    letterSpacing: "0",
    lineHeight: "23px",
    padding: "0 40px",
    margin: "0",
    marginTop: "10px",
    textAlign: "center" as const,
};

const footer = {
    color: "#000",
    fontSize: "12px",
    fontWeight: 800,
    letterSpacing: "0",
    lineHeight: "23px",
    margin: "0",
    marginTop: "20px",
    fontFamily: "HelveticaNeue,Helvetica,Arial,sans-serif",
    textAlign: "center" as const,
    textTransform: "uppercase" as const,
};

const button = {
    backgroundColor: "#007ee6",
    borderRadius: "4px",
    color: "#fff",
    fontFamily: "'Open Sans', 'Helvetica Neue', Arial",
    fontSize: "15px",
    textDecoration: "none",
    textAlign: "center" as const,
    display: "block",
    width: "210px",
    margin: "20px auto 0",
    padding: "14px 7px",
};
