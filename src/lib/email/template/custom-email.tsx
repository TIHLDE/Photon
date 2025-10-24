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
import { env } from "../../env";
import type { EmailContentBlock } from "../schema";

interface CustomEmailProps {
    subject: string;
    content: EmailContentBlock[];
}

export const CustomEmail = ({ subject, content }: CustomEmailProps) => {
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
                    {content.map((block, index) => {
                        switch (block.type) {
                            case "title":
                                return (
                                    // biome-ignore lint/suspicious/noArrayIndexKey: Is rendered in order, won't change
                                    <Heading key={index} style={heading}>
                                        {block.content}
                                    </Heading>
                                );
                            case "text":
                                return (
                                    // biome-ignore lint/suspicious/noArrayIndexKey: Is rendered in order, won't change
                                    <Text key={index} style={paragraph}>
                                        {block.content}
                                    </Text>
                                );
                            case "button":
                                return (
                                    <Button
                                        // biome-ignore lint/suspicious/noArrayIndexKey: Is rendered in order, won't change
                                        key={index}
                                        href={block.url}
                                        style={button}
                                    >
                                        {block.text}
                                    </Button>
                                );
                        }
                    })}
                </Container>
                <Text style={footer}>Levert av INDEX</Text>
            </Body>
        </Html>
    );
};

export default CustomEmail;

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

const heading = {
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
