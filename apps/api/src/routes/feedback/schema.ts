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
        isAnonymous: z.boolean().optional().meta({
            description:
                "Hide the author's name from everyone else. Defaults to anonymous.",
        }),
    }),
);

export const feedbackCommentParamSchema = z.object({
    id: z.uuid().meta({ description: "Feedback ID" }),
    commentId: z.uuid().meta({ description: "Comment ID" }),
});

export const createFeedbackCommentSchema = Schema(
    "CreateFeedbackComment",
    z.object({
        body: z.string().trim().min(1).max(2000),
    }),
);

export const updateFeedbackSchema = Schema(
    "UpdateFeedback",
    z.object({
        title: z.string().min(2).max(100).optional(),
        description: z.string().min(10).max(2000).optional(),
        isAnonymous: z.boolean().optional().meta({
            description: "Author only, and only while the feedback is editable",
        }),
        status: z.enum(feedbackStatusVariants).optional(),
        rejectionReason: z
            .string()
            .trim()
            .max(1000)
            .nullable()
            .optional()
            .meta({
                description:
                    "Why Index rejected it. Only allowed with status 'rejected'; cleared when the status changes.",
            }),
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

export const feedbackAuthorSchema = Schema(
    "FeedbackAuthor",
    z.object({
        id: z.string(),
        name: z.string(),
        image: z.string().nullable(),
    }),
);

export const feedbackItemSchema = Schema(
    "FeedbackItem",
    z.object({
        id: z.uuid().meta({ description: "Feedback ID" }),
        type: z.enum(feedbackTypeVariants),
        status: z.enum(feedbackStatusVariants),
        title: z.string(),
        description: z.string(),
        isAnonymous: z.boolean(),
        isAuthor: z.boolean().meta({
            description: "Whether the requesting user filed this.",
        }),
        author: feedbackAuthorSchema.nullable().meta({
            description:
                "Who filed it. Always null when the feedback is anonymous.",
        }),
        upvotes: z.number(),
        downvotes: z.number(),
        myVote: z
            .enum(feedbackVoteValueVariants)
            .nullable()
            .meta({ description: "The requesting user's own vote, if any" }),
        rejectionReason: z.string().nullable(),
        isEditable: z.boolean().meta({
            description:
                "Whether the requesting user may edit it: they filed it, it is still open, and nobody else has voted or commented.",
        }),
        commentCount: z.number(),
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

export const feedbackCommentSchema = Schema(
    "FeedbackComment",
    z.object({
        id: z.uuid(),
        body: z.string(),
        isFeedbackAuthor: z.boolean().meta({
            description: "Written by the person who filed the feedback",
        }),
        isMine: z.boolean(),
        author: feedbackAuthorSchema.nullable().meta({
            description:
                "Null when the feedback author replies on anonymous feedback, or the user is deleted.",
        }),
        createdAt: z.string(),
    }),
);

export const feedbackCommentListSchema = Schema(
    "FeedbackCommentList",
    z.array(feedbackCommentSchema),
);
