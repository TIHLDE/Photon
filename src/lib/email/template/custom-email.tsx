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
import { emailStyles } from "./styles";

interface CustomEmailProps {
    content: EmailContentBlock[];
}

export const CustomEmail = ({ content }: CustomEmailProps) => {
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
                    {content.map((block, index) => {
                        switch (block.type) {
                            case "title":
                                return (
                                    <Heading
                                        // biome-ignore lint/suspicious/noArrayIndexKey: Is rendered in order, won't change
                                        key={index}
                                        style={emailStyles.heading}
                                    >
                                        {block.content}
                                    </Heading>
                                );
                            case "text":
                                return (
                                    <Text
                                        // biome-ignore lint/suspicious/noArrayIndexKey: Is rendered in order, won't change
                                        key={index}
                                        style={emailStyles.paragraph}
                                    >
                                        {block.content}
                                    </Text>
                                );
                            case "button":
                                return (
                                    <Button
                                        // biome-ignore lint/suspicious/noArrayIndexKey: Is rendered in order, won't change
                                        key={index}
                                        href={block.url}
                                        style={emailStyles.button}
                                    >
                                        {block.text}
                                    </Button>
                                );
                        }
                    })}
                </Container>
                <Text style={emailStyles.footer}>Levert av INDEX</Text>
            </Body>
        </Html>
    );
};

export default CustomEmail;
