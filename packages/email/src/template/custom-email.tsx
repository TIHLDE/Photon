import React from "react";
import type { EmailContentBlock } from "../schema";
import { CtaButton, EmailLayout, Paragraph, Title } from "../components/layout";

export interface CustomEmailProps {
    content: EmailContentBlock[];
    logoUrl: string;
}

export const CustomEmail = ({ content, logoUrl }: CustomEmailProps) => {
    const firstText = content.find(
        (block) => block.type === "title" || block.type === "text",
    );

    return (
        <EmailLayout
            preview={
                firstText && "content" in firstText ? firstText.content : ""
            }
            logoUrl={logoUrl}
        >
            {content.map((block, index) => {
                switch (block.type) {
                    case "title":
                        // biome-ignore lint/suspicious/noArrayIndexKey: Is rendered in order, won't change
                        return <Title key={index}>{block.content}</Title>;
                    case "text":
                        return (
                            // biome-ignore lint/suspicious/noArrayIndexKey: Is rendered in order, won't change
                            <Paragraph key={index}>{block.content}</Paragraph>
                        );
                    case "button":
                        return (
                            // biome-ignore lint/suspicious/noArrayIndexKey: Is rendered in order, won't change
                            <CtaButton key={index} href={block.url}>
                                {block.text}
                            </CtaButton>
                        );
                }
            })}
        </EmailLayout>
    );
};

CustomEmail.PreviewProps = {
    content: [
        { type: "title", content: "Generalforsamling 2026" },
        {
            type: "text",
            content:
                "Det innkalles til ordinær generalforsamling i TIHLDE torsdag 3. desember kl. 18:00 i R1. Sakspapirer legges ut på nettsiden en uke før.",
        },
        { type: "button", text: "Les sakspapirene", url: "https://tihlde.org" },
        { type: "text", content: "Velkommen!" },
    ],
    logoUrl: "https://tihlde.org/logo512.png",
} satisfies CustomEmailProps;

export default CustomEmail;
