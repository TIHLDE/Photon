import z from "zod";
import { Schema } from "~/lib/openapi";

// ===== INPUT SCHEMAS =====

export const createStrikeSchema = Schema(
    "CreateStrike",
    z.object({
        userId: z
            .string()
            .max(255)
            .meta({ description: "User ID who receives the strike" }),
        eventId: z
            .uuid()
            .meta({ description: "Event the strike is connected to" }),
        count: z
            .number()
            .int()
            .min(1)
            .max(3)
            .default(1)
            .meta({ description: "Number of strikes (1-3)" }),
        reason: z
            .string()
            .max(256)
            .optional()
            .meta({ description: "Reason for the strike" }),
    }),
);

// ===== RESPONSE SCHEMAS =====

export const strikeSchema = Schema(
    "Strike",
    z.object({
        id: z.string().meta({ description: "Strike ID" }),
        userId: z
            .string()
            .meta({ description: "User ID who received the strike" }),
        eventId: z
            .string()
            .meta({ description: "Event the strike is connected to" }),
        count: z.number().meta({ description: "Number of strikes" }),
        reason: z
            .string()
            .nullable()
            .meta({ description: "Reason for the strike" }),
        createdAt: z.string().meta({ description: "Creation timestamp" }),
        user: z
            .object({
                id: z.string().meta({ description: "User ID" }),
                name: z.string().meta({ description: "User display name" }),
                image: z
                    .string()
                    .nullable()
                    .meta({ description: "User profile image URL" }),
            })
            .meta({ description: "Public user info for the struck user" }),
        event: z
            .object({
                id: z.string().meta({ description: "Event ID" }),
                title: z.string().meta({ description: "Event title" }),
                // Needed so a strike can link back to the event it came from.
                slug: z.string().meta({ description: "Event slug" }),
            })
            .meta({ description: "Event the strike belongs to" }),
    }),
);

export const strikeListResponseSchema = Schema(
    "StrikeList",
    z.object({
        totalCount: z.number().meta({ description: "Total number of strikes" }),
        pages: z.number().meta({ description: "Total number of pages" }),
        nextPage: z
            .number()
            .nullable()
            .meta({ description: "Next page number, or null if last page" }),
        strikes: z.array(strikeSchema),
    }),
);

export const deleteStrikeResponseSchema = Schema(
    "DeleteStrikeResponse",
    z.object({
        message: z.string(),
    }),
);
