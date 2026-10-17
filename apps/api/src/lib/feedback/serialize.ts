import { schema } from "@photon/db";
import type { FeedbackStatus, FeedbackType } from "@photon/db/schema";
import { type SQL, asc, eq, sql } from "drizzle-orm";
import type { AppContext } from "~/lib/ctx";
import { userImage } from "~/lib/user/avatar";

export type FeedbackAuthor = {
    id: string;
    name: string;
    image: string | null;
};

export type SerializedFeedbackItem = {
    id: string;
    type: FeedbackType;
    status: FeedbackStatus;
    title: string;
    description: string;
    isAnonymous: boolean;
    isAuthor: boolean;
    author: FeedbackAuthor | null;
    upvotes: number;
    downvotes: number;
    myVote: "up" | "down" | null;
    rejectionReason: string | null;
    isEditable: boolean;
    commentCount: number;
    createdAt: string;
    updatedAt: string;
};

export type SerializedFeedbackComment = {
    id: string;
    body: string;
    isFeedbackAuthor: boolean;
    isMine: boolean;
    author: FeedbackAuthor | null;
    createdAt: string;
};

/**
 * Vote counts are aggregated in the query rather than by loading every vote
 * row: the page shows a running tally per item and nothing else, and a popular
 * idea can collect hundreds of votes that would then be serialized only to be
 * counted and thrown away.
 */
export function selectFeedbackItems(db: AppContext["db"], userId: string) {
    return db
        .select({
            id: schema.feedback.id,
            type: schema.feedback.type,
            status: schema.feedback.status,
            title: schema.feedback.title,
            description: schema.feedback.description,
            createdAt: schema.feedback.createdAt,
            updatedAt: schema.feedback.updatedAt,
            authorId: schema.feedback.authorId,
            isAnonymous: schema.feedback.isAnonymous,
            rejectionReason: schema.feedback.rejectionReason,
            authorName: schema.user.name,
            authorImage: userImage(schema.user),
            upvotes:
                sql<number>`count(${schema.feedbackVote.userId}) filter (where ${schema.feedbackVote.value} = 'up')`.mapWith(
                    Number,
                ),
            downvotes:
                sql<number>`count(${schema.feedbackVote.userId}) filter (where ${schema.feedbackVote.value} = 'down')`.mapWith(
                    Number,
                ),
            myVote: sql<
                "up" | "down" | null
            >`max(${schema.feedbackVote.value}::text) filter (where ${schema.feedbackVote.userId} = ${userId})`,
            hasOthersVotes: sql<boolean>`count(${schema.feedbackVote.userId}) filter (where ${schema.feedbackVote.userId} is distinct from ${schema.feedback.authorId}) > 0`,
            hasOthersComments: sql<boolean>`exists (select 1 from ${schema.feedbackComment} where ${schema.feedbackComment.feedbackId} = ${schema.feedback.id} and ${schema.feedbackComment.authorId} is distinct from ${schema.feedback.authorId})`,
            commentCount:
                sql<number>`(select count(*) from ${schema.feedbackComment} where ${schema.feedbackComment.feedbackId} = ${schema.feedback.id})`.mapWith(
                    Number,
                ),
        })
        .from(schema.feedback)
        .leftJoin(
            schema.feedbackVote,
            eq(schema.feedbackVote.feedbackId, schema.feedback.id),
        )
        .leftJoin(schema.user, eq(schema.user.id, schema.feedback.authorId))
        .groupBy(schema.feedback.id, schema.user.id)
        .$dynamic();
}

type FeedbackItemRow = Awaited<
    ReturnType<ReturnType<typeof selectFeedbackItems>["execute"]>
>[number];

export function serializeFeedbackItem(
    row: FeedbackItemRow,
    userId: string,
): SerializedFeedbackItem {
    const author =
        !row.isAnonymous && row.authorId && row.authorName
            ? {
                  id: row.authorId,
                  name: row.authorName,
                  image: row.authorImage,
              }
            : null;

    const isAuthor = row.authorId !== null && row.authorId === userId;

    return {
        id: row.id,
        type: row.type,
        status: row.status,
        title: row.title,
        description: row.description,
        isAnonymous: row.isAnonymous,
        isAuthor,
        author,
        upvotes: row.upvotes,
        downvotes: row.downvotes,
        myVote: row.myVote,
        rejectionReason: row.rejectionReason,
        isEditable:
            isAuthor &&
            row.status === "open" &&
            !row.hasOthersVotes &&
            !row.hasOthersComments,
        commentCount: row.commentCount,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
    };
}

export async function getFeedbackItem(
    db: AppContext["db"],
    feedbackId: string,
    userId: string,
): Promise<SerializedFeedbackItem | null> {
    const [row] = await selectFeedbackItems(db, userId).where(
        eq(schema.feedback.id, feedbackId),
    );

    return row ? serializeFeedbackItem(row, userId) : null;
}

/**
 * The person who filed the feedback keeps the anonymity they chose when they
 * reply in the thread, even if they also moderate feedback — otherwise one
 * reply would reveal who wrote an anonymous report.
 */
export async function listFeedbackComments(
    db: AppContext["db"],
    feedback: { id: string; authorId: string | null; isAnonymous: boolean },
    userId: string,
    where?: SQL,
): Promise<SerializedFeedbackComment[]> {
    const rows = await db
        .select({
            id: schema.feedbackComment.id,
            body: schema.feedbackComment.body,
            authorId: schema.feedbackComment.authorId,
            createdAt: schema.feedbackComment.createdAt,
            authorName: schema.user.name,
            authorImage: userImage(schema.user),
        })
        .from(schema.feedbackComment)
        .leftJoin(
            schema.user,
            eq(schema.user.id, schema.feedbackComment.authorId),
        )
        .where(where ?? eq(schema.feedbackComment.feedbackId, feedback.id))
        .orderBy(
            asc(schema.feedbackComment.createdAt),
            asc(schema.feedbackComment.id),
        );

    return rows.map((row) => {
        const isFeedbackAuthor =
            row.authorId !== null && row.authorId === feedback.authorId;
        const hidden = isFeedbackAuthor && feedback.isAnonymous;

        return {
            id: row.id,
            body: row.body,
            isFeedbackAuthor,
            isMine: row.authorId !== null && row.authorId === userId,
            author:
                !hidden && row.authorId && row.authorName
                    ? {
                          id: row.authorId,
                          name: row.authorName,
                          image: row.authorImage,
                      }
                    : null,
            createdAt: row.createdAt.toISOString(),
        };
    });
}
