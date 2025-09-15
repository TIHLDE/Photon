import React from "react";
import {
    Body,
    Container,
    Head,
    Heading,
    Html,
    Img,
    Link,
    Section,
    Text,
} from "@react-email/components";
import { env } from "../../env";

interface OtpSignInProps {
    otp: string;
}

export const OtpSignInEmail = ({ otp = "123456" }: OtpSignInProps) => {
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
                        Skriv inn følgende kode
                        <br /> for å logge inn på TIHLDE
                    </Heading>
                    <Section style={codeContainer}>
                        <Text style={code}>{otp}</Text>
                    </Section>
                    <Text style={paragraph}>
                        Forventet du ikke denne e-posten?
                    </Text>
                    <Text style={paragraph}>
                        Du kan trygt ignorere denne e-posten hvis du ikke prøvde
                        å logge inn
                    </Text>
                </Container>
                <Text style={footer}>Levert av INDEX</Text>
            </Body>
        </Html>
    );
};

export default OtpSignInEmail;

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

const tertiary = {
    color: "#0a85ea",
    fontSize: "11px",
    fontWeight: 700,
    fontFamily: "HelveticaNeue,Helvetica,Arial,sans-serif",
    height: "16px",
    letterSpacing: "0",
    lineHeight: "16px",
    margin: "16px 8px 8px 8px",
    textTransform: "uppercase" as const,
    textAlign: "center" as const,
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
    width: "100%",
    textAlign: "center" as const,
};

const codeContainer = {
    background: "rgba(0,0,0,.05)",
    borderRadius: "4px",
    margin: "16px auto 14px",
    verticalAlign: "middle",
    width: "280px",
};

const code = {
    color: "#000",
    fontFamily: "HelveticaNeue-Bold",
    fontSize: "32px",
    fontWeight: 700,
    letterSpacing: "6px",
    lineHeight: "40px",
    paddingBottom: "8px",
    paddingTop: "8px",
    margin: "0 auto",
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
