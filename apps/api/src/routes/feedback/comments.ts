import { schema } from "@photon/db";
import { and, eq, isNotNull, ne } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import type z from "zod";
import type { AppContext } from "~/lib/ctx";
import { isFeedbackAuthor } from "~/lib/feedback/middleware";
import { listFeedbackComments } from "~/lib/feedback/serialize";
import { sendNotification } from "~/lib/notification";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import {
    createFeedbackCommentSchema,
    feedbackCommentListSchema,
    feedbackCommentParamSchema,
    feedbackCommentSchema,
    feedbackIdParamSchema,
    feedbackMessageResponseSchema,
} from "./schema";

const EXCERPT_LENGTH = 200;

function excerpt(text: string) {
    return text.length > EXCERPT_LENGTH
        ? `${text.slice(0, EXCERPT_LENGTH - 1)}…`
        : text;
}

async function findFeedback(db: AppContext["db"], id: string) {
    const feedback = await db.query.feedback.findFirst({
        where: eq(schema.feedback.id, id),
        columns: { id: true, title: true, authorId: true, isAnonymous: true },
    });

    if (!feedback) {
        throw new HTTPException(404, { message: "Feedback not found" });
    }

    return feedback;
}

const isFeedbackCommentAuthor = async (
    ctx: AppContext,
    commentId: string,
    userId: string,
): Promise<boolean> => {
    const comment = await ctx.db.query.feedbackComment.findFirst({
        where: eq(schema.feedbackComment.id, commentId),
        columns: { authorId: true },
    });

    return comment?.authorId != null && comment.authorId === userId;
};

export const listCommentsRoute = route().get(
    "/:id/comments",
    describeRoute({
        tags: ["feedback"],
        summary: "List feedback comments",
        operationId: "listFeedbackComments",
        description:
            "Replies from Index and the author, oldest first. Visible to every logged-in member.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: feedbackCommentListSchema,
            description: "OK",
        })
        .notFound({ description: "Feedback not found" })
        .build(),
    requireAuth,
    validator("param", feedbackIdParamSchema),
    async (c) => {
        const { db } = c.get("ctx");
        const { id } = c.req.valid("param");

        const feedback = await findFeedback(db, id);

        return c.json(
            (await listFeedbackComments(
                db,
                feedback,
                c.get("user").id,
            )) satisfies z.infer<typeof feedbackCommentListSchema>,
        );
    },
);

export const createCommentRoute = route().post(
    "/:id/comments",
    describeRoute({
        tags: ["feedback"],
        summary: "Comment on feedback",
        operationId: "createFeedbackComment",
        description:
            "Reply in a feedback thread. Requires 'feedback:update' or 'feedback:manage', or being the author. A reply from Index notifies the author; a reply from the author notifies the Index members in the thread.",
    })
        .schemaResponse({
            statusCode: 201,
            schema: feedbackCommentSchema,
            description: "Comment created",
        })
        .forbidden({ description: "Insufficient permissions" })
        .notFound({ description: "Feedback not found" })
        .build(),
    requireAuth,
    validator("param", feedbackIdParamSchema),
    requireAccess({
        permission: ["feedback:update", "feedback:manage"],
        ownership: { param: "id", check: isFeedbackAuthor },
    }),
    validator("json", createFeedbackCommentSchema),
    async (c) => {
        const ctx = c.get("ctx");
        const { db } = ctx;
        const { id } = c.req.valid("param");
        const { body } = c.req.valid("json");
        const userId = c.get("user").id;

        const feedback = await findFeedback(db, id);

        const [created] = await db
            .insert(schema.feedbackComment)
            .values({ feedbackId: id, authorId: userId, body })
            .returning({ id: schema.feedbackComment.id });

        if (!created) {
            throw new Error("Failed to create feedback comment");
        }

        const link = `/tilbakemelding?id=${id}`;
        const isAuthorReply = feedback.authorId === userId;

        const recipients = isAuthorReply
            ? (
                  await db
                      .selectDistinct({
                          userId: schema.feedbackComment.authorId,
                      })
                      .from(schema.feedbackComment)
                      .where(
                          and(
                              eq(schema.feedbackComment.feedbackId, id),
                              isNotNull(schema.feedbackComment.authorId),
                              ne(schema.feedbackComment.authorId, userId),
                          ),
                      )
              )
                  .map((row) => row.userId)
                  .filter((recipient) => recipient !== null)
            : feedback.authorId
              ? [feedback.authorId]
              : [];

        const notification = isAuthorReply
            ? {
                  title: `Nytt svar på «${feedback.title}»`,
                  description: `Innsenderen har svart: ${excerpt(body)}`,
              }
            : {
                  title: "Index har svart på tilbakemeldingen din",
                  description: `«${feedback.title}»: ${excerpt(body)}`,
              };

        // The comment is already saved; a failed mail or push must not turn
        // that into an error for the person who wrote it.
        for (const recipient of recipients) {
            try {
                await sendNotification(
                    { userId: recipient, ...notification, link },
                    ctx,
                );
            } catch (error) {
                c.get("logger")?.error(
                    { err: error, feedbackId: id, commentId: created.id },
                    "Failed to send feedback comment notification",
                );
            }
        }

        const [comment] = await listFeedbackComments(
            db,
            feedback,
            userId,
            eq(schema.feedbackComment.id, created.id),
        );

        if (!comment) {
            throw new Error("Failed to load feedback comment");
        }

        return c.json(
            comment satisfies z.infer<typeof feedbackCommentSchema>,
            201,
        );
    },
);

export const deleteCommentRoute = route().delete(
    "/:id/comments/:commentId",
    describeRoute({
        tags: ["feedback"],
        summary: "Delete feedback comment",
        operationId: "deleteFeedbackComment",
        description:
            "Delete a comment. Requires 'feedback:manage', or having written it.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: feedbackMessageResponseSchema,
            description: "Comment deleted",
        })
        .forbidden({ description: "Insufficient permissions" })
        .notFound({ description: "Comment not found" })
        .build(),
    requireAuth,
    validator("param", feedbackCommentParamSchema),
    requireAccess({
        permission: "feedback:manage",
        ownership: { param: "commentId", check: isFeedbackCommentAuthor },
    }),
    async (c) => {
        const { db } = c.get("ctx");
        const { id, commentId } = c.req.valid("param");

        const [deleted] = await db
            .delete(schema.feedbackComment)
            .where(
                and(
                    eq(schema.feedbackComment.id, commentId),
                    eq(schema.feedbackComment.feedbackId, id),
                ),
            )
            .returning({ id: schema.feedbackComment.id });

        if (!deleted) {
            throw new HTTPException(404, { message: "Comment not found" });
        }

        return c.json({ message: "Kommentaren ble slettet" });
    },
);
