import z from "zod";
import { Schema } from "~/lib/openapi";
import {
    PaginationSchema,
    PagniationResponseSchema,
} from "~/middleware/pagination";

// ===== INPUT SCHEMAS =====

/**
 * The `:id` segment, checked before it reaches the database.
 *
 * Lepton numbered its articles, Photon uses UUIDs, and the migration kept no
 * mapping between the two — so every `/nyheter/302` still out there arrives
 * here as a non-UUID. Postgres answers that with `22P02 invalid input syntax
 * for type uuid`, which reaches the error handler as a 500: an ordinary dead
 * link reported as a server fault, ~46 times over three days in production.
 */
export const newsIdParamSchema = z.object({
    id: z.uuid().meta({ description: "News article ID" }),
});

export const createNewsSchema = Schema(
    "CreateNews",
    z.object({
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
        body: z
            .string()
            .min(1)
            .meta({ description: "Main content of the news" }),
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
    }),
);

export const updateNewsSchema = Schema(
    "UpdateNews",
    z.object({
        title: z.string().min(1).max(200).optional(),
        header: z.string().min(1).max(200).optional(),
        body: z.string().min(1).optional(),
        imageUrl: z.url().optional().nullable(),
        imageAlt: z.string().max(255).optional().nullable(),
        emojisAllowed: z.boolean().optional(),
        archived: z.boolean().optional().meta({
            description:
                "Archive or restore the article. An archived article disappears from the public news pages but stays in the admin panel.",
        }),
    }),
);

/**
 * Which articles the list should return.
 *
 * `exclude` is the default because the list is public: an archived article is
 * one someone deliberately took off the website, so leaving it out has to be
 * what a caller gets without asking. `include` and `only` are for the admin
 * panel and need a news permission.
 */
export const newsListFilterSchema = PaginationSchema.extend({
    archived: z.enum(["exclude", "include", "only"]).default("exclude").meta({
        description:
            "Whether to return archived articles. 'exclude' (default) returns only live articles, 'only' returns only archived ones, 'include' returns both. Anything but 'exclude' requires a news permission.",
    }),
});

export const createReactionSchema = Schema(
    "CreateNewsReaction",
    z.object({
        emoji: z
            .string()
            .min(1)
            .max(32)
            .meta({ description: "Emoji reaction (e.g., 👍, ❤️, 😂)" }),
    }),
);

// ===== RESPONSE SCHEMAS =====

export const newsArticleSchema = Schema(
    "NewsArticle",
    z.object({
        id: z.uuid().meta({ description: "News article ID" }),
        title: z.string().meta({ description: "News article title" }),
        header: z
            .string()
            .meta({ description: "News article subtitle/ingress" }),
        body: z.string().meta({ description: "Main content" }),
        imageUrl: z.string().nullable().meta({ description: "Image URL" }),
        imageAlt: z.string().nullable().meta({ description: "Image alt text" }),
        emojisAllowed: z
            .boolean()
            .meta({ description: "Whether reactions are enabled" }),
        archivedAt: z.string().nullable().meta({
            description:
                "When the article was archived (ISO 8601), or null if it is live",
        }),
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
        archivedAt: z.string().nullable().meta({
            description:
                "When the article was archived (ISO 8601), or null if it is live",
        }),
        createdAt: z.iso
            .date()
            .meta({ description: "Creation time (ISO 8601)" }),
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
