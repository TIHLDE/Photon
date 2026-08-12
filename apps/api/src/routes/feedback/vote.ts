import { schema } from "@photon/db";
import { and, eq, sql } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import type z from "zod";
import type { AppContext } from "~/lib/ctx";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import {
    feedbackIdParamSchema,
    feedbackVoteCountsSchema,
    voteFeedbackSchema,
} from "./schema";

/** The tally the frontend redraws the buttons from, after a vote changed. */
async function voteCounts(
    db: AppContext["db"],
    feedbackId: string,
): Promise<{ upvotes: number; downvotes: number }> {
    const [counts] = await db
        .select({
            upvotes:
                sql<number>`count(*) filter (where ${schema.feedbackVote.value} = 'up')`.mapWith(
                    Number,
                ),
            downvotes:
                sql<number>`count(*) filter (where ${schema.feedbackVote.value} = 'down')`.mapWith(
                    Number,
                ),
        })
        .from(schema.feedbackVote)
        .where(eq(schema.feedbackVote.feedbackId, feedbackId));

    return {
        upvotes: counts?.upvotes ?? 0,
        downvotes: counts?.downvotes ?? 0,
    };
}

export const voteRoute = route().put(
    "/:id/vote",
    describeRoute({
        tags: ["feedback"],
        summary: "Vote on feedback",
        operationId: "voteFeedback",
        description:
            "Cast or change your vote on a piece of feedback. One vote per user — voting again replaces the previous one.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: feedbackVoteCountsSchema,
            description: "Vote registered",
        })
        .notFound({ description: "Feedback not found" })
        .build(),
    requireAuth,
    validator("param", feedbackIdParamSchema),
    validator("json", voteFeedbackSchema),
    async (c) => {
        const { db } = c.get("ctx");
        const userId = c.get("user").id;
        const { id } = c.req.valid("param");
        const { value } = c.req.valid("json");

        const existing = await db.query.feedback.findFirst({
            where: eq(schema.feedback.id, id),
        });

        if (!existing) {
            throw new HTTPException(404, { message: "Feedback not found" });
        }

        /**
         * Upsert rather than delete-then-insert: the primary key is
         * (feedback, user), so switching from thumbs up to thumbs down is one
         * statement and two users voting at once cannot collide.
         */
        await db
            .insert(schema.feedbackVote)
            .values({ feedbackId: id, userId, value })
            .onConflictDoUpdate({
                target: [
                    schema.feedbackVote.feedbackId,
                    schema.feedbackVote.userId,
                ],
                set: { value },
            });

        return c.json({
            ...(await voteCounts(db, id)),
            myVote: value,
        } satisfies z.infer<typeof feedbackVoteCountsSchema>);
    },
);

export const deleteVoteRoute = route().delete(
    "/:id/vote",
    describeRoute({
        tags: ["feedback"],
        summary: "Remove your vote",
        operationId: "deleteFeedbackVote",
        description: "Take back your vote on a piece of feedback.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: feedbackVoteCountsSchema,
            description: "Vote removed",
        })
        .notFound({ description: "Feedback not found" })
        .build(),
    requireAuth,
    validator("param", feedbackIdParamSchema),
    async (c) => {
        const { db } = c.get("ctx");
        const userId = c.get("user").id;
        const { id } = c.req.valid("param");

        const existing = await db.query.feedback.findFirst({
            where: eq(schema.feedback.id, id),
        });

        if (!existing) {
            throw new HTTPException(404, { message: "Feedback not found" });
        }

        // No 404 when there is no vote: the end state the caller asked for —
        // "my vote is gone" — is the state either way.
        await db
            .delete(schema.feedbackVote)
            .where(
                and(
                    eq(schema.feedbackVote.feedbackId, id),
                    eq(schema.feedbackVote.userId, userId),
                ),
            );

        return c.json({
            ...(await voteCounts(db, id)),
            myVote: null,
        } satisfies z.infer<typeof feedbackVoteCountsSchema>);
    },
);
