import z from "zod";
import { Schema } from "~/lib/openapi";
import { PagniationResponseSchema } from "~/middleware/pagination";

// ===== INPUT SCHEMAS =====

export const createNewsSchema = z.object({
    title: z
        .string()
        .min(1)
        .max(200)
        .meta({ description: "News article title" }),
    header: z
        .string()
        .min(1)
        .max(200)
        .meta({ description: "News article subtitle/ingress" }),
    body: z.string().min(1).meta({ description: "Main content of the news" }),
    imageUrl: z
        .string()
        .url()
        .optional()
        .meta({ description: "Optional image URL" }),
    imageAlt: z
        .string()
        .max(255)
        .optional()
        .meta({ description: "Alt text for the image" }),
    emojisAllowed: z
        .boolean()
        .default(false)
        .meta({ description: "Whether reactions are enabled" }),
});

export const updateNewsSchema = z.object({
    title: z.string().min(1).max(200).optional(),
    header: z.string().min(1).max(200).optional(),
    body: z.string().min(1).optional(),
    imageUrl: z.url().optional().nullable(),
    imageAlt: z.string().max(255).optional().nullable(),
    emojisAllowed: z.boolean().optional(),
});

export const createReactionSchema = z.object({
    emoji: z
        .string()
        .min(1)
        .max(32)
        .meta({ description: "Emoji reaction (e.g., 👍, ❤️, 😂)" }),
});

// ===== RESPONSE SCHEMAS =====

export const newsArticleSchema = Schema(
    "NewsArticle",
    z.object({
        id: z.uuid().meta({ description: "News article ID" }),
        title: z.string().meta({ description: "News article title" }),
        header: z.string().meta({ description: "News article subtitle/ingress" }),
        body: z.string().meta({ description: "Main content" }),
        imageUrl: z.string().nullable().meta({ description: "Image URL" }),
        imageAlt: z.string().nullable().meta({ description: "Image alt text" }),
        emojisAllowed: z
            .boolean()
            .meta({ description: "Whether reactions are enabled" }),
        createdById: z
            .string()
            .nullable()
            .meta({ description: "Creator user ID" }),
        createdAt: z.string().meta({ description: "Creation time (ISO 8601)" }),
        updatedAt: z
            .string()
            .meta({ description: "Last update time (ISO 8601)" }),
        creator: z
            .object({
                id: z.string(),
                name: z.string(),
                email: z.string(),
            })
            .nullable()
            .meta({ description: "Creator user info" }),
        reactions: z.array(
            z.object({
                userId: z.string(),
                newsId: z.uuid(),
                emoji: z.string(),
                createdAt: z.string(),
                user: z.object({
                    id: z.string(),
                    name: z.string(),
                }),
            }),
        ),
    }),
);

export const newsListItemSchema = Schema(
    "NewsListItem",
    z.object({
        id: z.uuid({ version: "v4" }).meta({ description: "News ID" }),
        title: z.string().meta({ description: "News title" }),
        header: z.string().meta({ description: "News header" }),
        body: z.string().meta({ description: "News body" }),
        imageUrl: z.string().nullable().meta({ description: "Image URL" }),
        imageAlt: z.string().nullable().meta({ description: "Image alt text" }),
        emojisAllowed: z
            .boolean()
            .meta({ description: "Whether reactions are allowed" }),
        createdAt: z.iso.date().meta({ description: "Creation time (ISO 8601)" }),
        updatedAt: z.iso
            .date()
            .meta({ description: "Last update time (ISO 8601)" }),
    }),
);

export const newsListResponseSchema = Schema(
    "NewsList",
    PagniationResponseSchema.extend({
        items: z.array(newsListItemSchema).describe("List of news articles"),
    }),
);

export const newsReactionSchema = Schema(
    "NewsReaction",
    z.object({
        userId: z.string().meta({ description: "User ID" }),
        newsId: z.uuid().meta({ description: "News article ID" }),
        emoji: z.string().meta({ description: "Emoji reaction" }),
        createdAt: z
            .string()
            .meta({ description: "Reaction creation time (ISO 8601)" }),
    }),
);

export const deleteNewsResponseSchema = Schema(
    "DeleteNewsResponse",
    z.object({
        message: z.string(),
    }),
);

export const deleteReactionResponseSchema = Schema(
    "DeleteNewsReactionResponse",
    z.object({
        message: z.string(),
    }),
);
