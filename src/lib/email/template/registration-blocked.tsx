import {
    Body,
    Container,
    Head,
    Heading,
    Html,
    Img,
    Text,
} from "@react-email/components";
import React from "react";
import { env } from "../../env";

interface RegistrationBlockedEmailProps {
    eventName: string;
    reason?: string;
}

export const RegistrationBlockedEmail = ({
    eventName = "Eksempel arrangement",
    reason = "Du har for mange prikker og kan ikke melde deg på arrangementet enda.",
}: RegistrationBlockedEmailProps) => {
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
                        Påmelding ble ikke godkjent
                    </Heading>
                    <Text style={paragraph}>
                        Din påmelding til <strong>{eventName}</strong> ble
                        dessverre ikke godkjent.
                    </Text>
                    <Text style={paragraph}>
                        <strong>Årsak:</strong> {reason}
                    </Text>
                    <Text style={paragraph}>
                        Ta kontakt med arrangementet hvis du mener dette er en
                        feil.
                    </Text>
                </Container>
                <Text style={footer}>Levert av INDEX</Text>
            </Body>
        </Html>
    );
};

export default RegistrationBlockedEmail;

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
