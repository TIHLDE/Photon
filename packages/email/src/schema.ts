import { z } from "zod";

/**
 * Email content block types
 */
export const emailContentBlockSchema = z.discriminatedUnion("type", [
    z
        .object({
            type: z
                .literal("title")
                .meta({ description: "Content block type" }),
            content: z
                .string()
                .min(1, "Title content cannot be empty")
                .meta({ description: "The title text to display" }),
        })
        .meta({ title: "Title" }),
    z
        .object({
            type: z.literal("text").meta({ description: "Content block type" }),
            content: z
                .string()
                .min(1, "Text content cannot be empty")
                .meta({ description: "The paragraph text to display" }),
        })
        .meta({ title: "Text" }),
    z
        .object({
            type: z
                .literal("button")
                .meta({ description: "Content block type" }),
            text: z
                .string()
                .min(1, "Button text cannot be empty")
                .meta({ description: "The button label text" }),
            url: z
                .url("Button URL must be a valid URL")
                .meta({ description: "The URL the button links to" }),
        })
        .meta({ title: "Button" }),
]);

/**
 * Schema for sending custom emails via API
 */
export const sendCustomEmailSchema = z.object({
    to: z
        .union([
            z.email("Must be a valid email address"),
            z
                .array(z.email("Each recipient must be a valid email address"))
                .min(1, "Must provide at least one recipient"),
        ])
        .meta({
            description:
                "Recipient email address (string) or list of recipient email addresses (array)",
        }),
    subject: z
        .string()
        .min(1, "Subject cannot be empty")
        .meta({ description: "Email subject line" }),
    content: z
        .array(emailContentBlockSchema)
        .min(1, "Email must have at least one content block")
        .meta({
            description:
                "Array of content blocks (title, text, or button) to render in the email",
        }),
});

export type EmailContentBlock = z.infer<typeof emailContentBlockSchema>;

export type SendCustomEmailRequest = z.infer<typeof sendCustomEmailSchema>;
