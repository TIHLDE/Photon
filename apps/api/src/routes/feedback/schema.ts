import {
    feedbackStatusVariants,
    feedbackTypeVariants,
    feedbackVoteValueVariants,
} from "@photon/db/schema";
import z from "zod";
import { Schema } from "~/lib/openapi";
import { PagniationResponseSchema } from "~/middleware/pagination";

// ===== INPUT SCHEMAS =====

export const feedbackIdParamSchema = z.object({
    id: z.uuid().meta({ description: "Feedback ID" }),
});

export const createFeedbackSchema = Schema(
    "CreateFeedback",
    z.object({
        type: z
            .enum(feedbackTypeVariants)
            .meta({ description: "Idea or bug report" }),
        title: z.string().min(2).max(100).meta({ description: "Short title" }),
        description: z
            .string()
            .min(10)
            .max(2000)
            .meta({ description: "What the idea or the bug is" }),
    }),
);

export const updateFeedbackSchema = Schema(
    "UpdateFeedback",
    z.object({
        title: z.string().min(2).max(100).optional(),
        description: z.string().min(10).max(2000).optional(),
        status: z.enum(feedbackStatusVariants).optional(),
    }),
);

export const voteFeedbackSchema = Schema(
    "VoteFeedback",
    z.object({
        value: z
            .enum(feedbackVoteValueVariants)
            .meta({ description: "Thumbs up or thumbs down" }),
    }),
);

export const listFeedbackQuerySchema = z.object({
    type: z.enum(feedbackTypeVariants).optional(),
    status: z.enum(feedbackStatusVariants).optional(),
    search: z
        .string()
        .optional()
        .describe("Free-text search in title and description"),
});

// ===== RESPONSE SCHEMAS =====

const feedbackAuthorSchema = z
    .object({
        id: z.string(),
        name: z.string(),
        image: z.string().nullable(),
    })
    .nullable()
    .meta({ description: "Author, null if the user has been deleted" });

export const feedbackItemSchema = Schema(
    "FeedbackItem",
    z.object({
        id: z.uuid().meta({ description: "Feedback ID" }),
        type: z.enum(feedbackTypeVariants),
        status: z.enum(feedbackStatusVariants),
        title: z.string(),
        description: z.string(),
        author: feedbackAuthorSchema,
        upvotes: z.number(),
        downvotes: z.number(),
        myVote: z
            .enum(feedbackVoteValueVariants)
            .nullable()
            .meta({ description: "The requesting user's own vote, if any" }),
        createdAt: z.string().meta({ description: "Creation time (ISO 8601)" }),
        updatedAt: z
            .string()
            .meta({ description: "Last update time (ISO 8601)" }),
    }),
);

export const feedbackListResponseSchema = Schema(
    "FeedbackList",
    PagniationResponseSchema.extend({
        items: z.array(feedbackItemSchema).describe("List of feedback"),
    }),
);

export const feedbackVoteCountsSchema = Schema(
    "FeedbackVoteCounts",
    z.object({
        upvotes: z.number(),
        downvotes: z.number(),
        myVote: z.enum(feedbackVoteValueVariants).nullable(),
    }),
);

export const feedbackMessageResponseSchema = Schema(
    "FeedbackMessageResponse",
    z.object({
        message: z.string(),
    }),
);
